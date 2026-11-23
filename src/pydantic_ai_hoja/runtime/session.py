"""``HojaSession``: one conversation's link to the Hoja runtime.

The runtime is the bundled Node server every Hoja plugin runs (Trebol's TaskManage engine, its task gate, Hoja mode
and session traces). This class starts it, lists its tools, forwards each lifecycle event as a ``__hoja_hook`` call in
Claude Code's hook dialect, and turns the answers into plain decisions a host adapter can act on:

====================  ===================================  ==========================================
Host moment           Hook sent                            Decision returned
====================  ===================================  ==========================================
user prompt           ``UserPromptSubmit``                 :class:`PromptDecision` (context / command)
before a tool runs    ``PreToolUse``                       :class:`ToolDecision` (block / context)
after a tool ran      ``PostToolUse`` / ``…Failure``       context for the next model request
tool batch finished   ``PostToolBatch``                    context for the next model request
model ended its turn  ``Stop``                             :class:`StopDecision` (continue / notice)
``/hoja:<command>``   ``UserPromptExpansion``              the command's output text
====================  ===================================  ==========================================

All decisions are made by the runtime; nothing here second-guesses them.
"""

from __future__ import annotations

import atexit
import json
import logging
import subprocess
import threading
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .bundle import bundle_file, check_node
from .names import ToolNames, bridge_args
from .rpc import RpcError, StdioRpc
from .settings import HojaSettings
from .transcript import BLOCKED_PREFIX, ToolUse, Transcript, Usage, result_text

logger = logging.getLogger("pydantic_ai_hoja")

HOOK_TOOL = "__hoja_hook"
#: Local commands the runtime registers (``/hoja:tasks``, ``/hoja:hoja on``, ``/hoja:trace``, ``/hoja:setup``).
COMMANDS = ("tasks", "hoja", "trace", "setup")


class HojaRuntimeError(RuntimeError):
    """The runtime could not start (no Node.js, a broken bundle) or stopped answering."""


@dataclass(frozen=True)
class ToolSpec:
    """A tool the runtime serves, as MCP lists it."""

    name: str
    description: str
    input_schema: dict[str, Any]
    hosted: bool = False
    """``True`` for the hosted Hoja API (``hoja_issues``, ``hoja_taskUpdate``, …), ``False`` for TaskManage & co."""


@dataclass(frozen=True)
class ToolDecision:
    blocked: bool = False
    reason: str = ""
    context: str = ""

    @property
    def blocked_result(self) -> str:
        """What the model receives instead of the tool's result, worded the way the runtime recognizes a block."""
        return self.reason if BLOCKED_PREFIX in self.reason else BLOCKED_PREFIX + self.reason


@dataclass(frozen=True)
class PromptDecision:
    context: str = ""
    """Extra context for the model's next request."""
    command_output: str | None = None
    """Set when the prompt was a local command (``/hoja:tasks``): show this and do not run the model."""


@dataclass(frozen=True)
class StopDecision:
    continue_with: str = ""
    """Non-empty: the turn ended on a gate block that the runtime can resolve. Send this back to the model."""
    notice: str = ""
    """Non-empty: something the user should see (the auto-continue budget ran out)."""


@dataclass
class _ToolCall:
    bridged: str
    args: dict[str, Any]


@dataclass
class HojaSession:
    """One conversation. Cheap to construct; the runtime starts on first use. Safe to share across runs and threads.

    Example::

        session = HojaSession(settings=HojaSettings.from_env(), cwd=Path.cwd())
        decision = await session.pre_tool("shell", {"command": "rm -rf build"}, call_id="c1")
        if decision.blocked:
            ...
    """

    settings: HojaSettings = field(default_factory=HojaSettings.from_env)
    cwd: Path = field(default_factory=Path.cwd)
    session_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    names: ToolNames = field(default_factory=ToolNames)

    def __post_init__(self) -> None:
        self.cwd = Path(self.cwd).resolve()
        self.transcript = Transcript(self.transcript_path, self.session_id, self.cwd)
        self._server: StdioRpc | None = None
        self._api: StdioRpc | None = None
        self._tools: list[ToolSpec] | None = None
        self._context: str | None = None
        self._calls: dict[str, _ToolCall] = {}
        self._message_id: str | None = None  # the model response whose tool calls are being recorded
        self._lock = threading.Lock()
        self._closed = False

    # -- lifecycle -------------------------------------------------------------------------------------------------

    @property
    def transcript_path(self) -> Path:
        return self.settings.data_dir / "transcripts" / f"{self.session_id}.jsonl"

    @property
    def started(self) -> bool:
        return self._server is not None and self._server.running

    def start(self) -> None:
        """Start the runtime (and the hosted API proxy). Idempotent; called lazily by every other method."""
        with self._lock:
            if self.started:
                return
            if self._closed:
                raise HojaRuntimeError("this HojaSession was closed")
            node = check_node(self.settings)
            env = self.settings.bundle_env(self.cwd)
            self.settings.data_dir.mkdir(parents=True, exist_ok=True)
            self._server = StdioRpc([node, str(bundle_file("server.mjs"))], name="hoja", env=env, cwd=self.cwd)
            try:
                self._server.start()
                if self.settings.hosted_api:
                    self._api = StdioRpc(
                        [node, str(bundle_file("api-proxy.mjs"))], name="hoja-api", env=env, cwd=self.cwd
                    )
                    self._api.start()
            except (RpcError, OSError) as error:
                raise HojaRuntimeError(f"the Hoja runtime did not start: {error}") from error
            atexit.register(self.close)

    def close(self) -> None:
        """End the session: the runtime flushes its journal and trace, then exits. Idempotent."""
        if self._closed:
            return
        self._closed = True
        if self.started:
            try:
                self._hook_sync("SessionEnd", {"reason": "exit"}, timeout=10)
            except (RpcError, TimeoutError) as error:
                logger.debug("SessionEnd failed: %s", error)
        for rpc in (self._api, self._server):
            if rpc is not None:
                rpc.close()

    # -- tools -----------------------------------------------------------------------------------------------------

    def tools(self, *, refresh: bool = False) -> list[ToolSpec]:
        """TaskManage, hoja_list/get/project (in Hoja mode), hoja_trace, hoja_setup and, if enabled, the hosted API."""
        if self._tools is not None and not refresh:
            return self._tools
        self.start()
        assert self._server is not None
        specs = [_spec(t, hosted=False) for t in self._server.request("tools/list", {}).get("tools", [])]
        if self._api is not None:
            own = {s.name for s in specs}
            specs += [
                _spec(t, hosted=True)
                for t in self._api.request("tools/list", {}).get("tools", [])
                if t["name"] not in own
            ]
        self.names.own = {s.name for s in specs if not s.hosted}
        self.names.api = {s.name for s in specs if s.hosted}
        self._tools = specs
        return specs

    async def call_tool(self, name: str, args: dict[str, Any]) -> tuple[str, bool]:
        """Run one of the runtime's tools. Returns ``(text, is_error)``."""
        self.start()
        rpc = self._api if name in self.names.api else self._server
        assert rpc is not None
        result = await rpc.arequest("tools/call", {"name": name, "arguments": args})
        text = "\n".join(str(p.get("text", "")) for p in result.get("content", []) if p.get("type") == "text")
        return text, bool(result.get("isError"))

    # -- hooks -----------------------------------------------------------------------------------------------------

    async def user_prompt(self, prompt: str) -> PromptDecision:
        """A user turn begins. Records it, and answers ``/hoja:<command>`` prompts locally."""
        out = await self._hook("UserPromptSubmit", {"prompt": prompt})
        if out.get("decision") == "block":
            return PromptDecision(command_output=str(out.get("reason", "")))
        self._message_id = None
        self.transcript.user(prompt)
        return PromptDecision(context=_context(out))

    async def pre_tool(self, name: str, args: Any, *, call_id: str) -> ToolDecision:
        """Ask the gate before a tool runs. The tool use is recorded either way."""
        bridged = self.names.bridge(name)
        bargs = bridge_args(bridged, args)
        self._calls[call_id] = _ToolCall(bridged, bargs)
        self.transcript.assistant(tool_uses=[ToolUse(call_id, bridged, bargs)], message_id=self._message_id)
        out = await self._hook("PreToolUse", {"tool_name": bridged, "tool_input": bargs, "tool_use_id": call_id})
        specific = out.get("hookSpecificOutput") or {}
        if specific.get("permissionDecision") == "deny":
            decision = ToolDecision(blocked=True, reason=str(specific.get("permissionDecisionReason", "")))
            self.transcript.tool_result(call_id, decision.blocked_result, is_error=True)
            self._calls.pop(call_id, None)
            return decision
        return ToolDecision(context=_context(out))

    async def post_tool(self, call_id: str, result: Any, *, failed: bool = False) -> str:
        """Report a finished tool call. Returns context for the model, if any."""
        call = self._calls.pop(call_id, None)
        if call is None:  # blocked, or never announced
            return ""
        text = result_text(result)
        self.transcript.tool_result(call_id, text, is_error=failed)
        event = "PostToolUseFailure" if failed else "PostToolUse"
        payload: dict[str, Any] = {"tool_name": call.bridged, "tool_input": call.args, "tool_use_id": call_id}
        payload["error" if failed else "tool_response"] = text
        return _context(await self._hook(event, payload))

    async def tool_batch_end(self) -> str:
        """Every tool call of one model response has finished. Returns the turn's queued context, if any."""
        return _context(await self._hook("PostToolBatch", {}))

    def model_response(
        self,
        *,
        text: str,
        usage: Usage | None = None,
        model: str | None = None,
        message_id: str | None = None,
        tool_calls: bool = False,
    ) -> None:
        """Record a model response's text and token usage.

        Its tool calls are recorded by :meth:`pre_tool` under the same message id, which is how Claude Code's
        transcript joins the blocks of one response.
        """
        recorded = self.transcript.assistant(
            text=text,
            usage=usage,
            model=model,
            message_id=message_id,
            stop_reason="tool_use" if tool_calls else "end_turn",
        )
        self._message_id = recorded if tool_calls else None

    async def stop(self, last_message: str) -> StopDecision:
        """The model ended its turn. The runtime decides whether a gate block should send it back to work."""
        out = await self._hook("Stop", {"stop_hook_active": False, "last_assistant_message": last_message})
        return StopDecision(continue_with=_context(out), notice=str(out.get("systemMessage", "")))

    def command(self, name: str, args: str = "") -> str:
        """Run a local command (``tasks``, ``hoja on``, ``trace upload HOJA-1``, ``setup``) and return its output."""
        out = self._hook_sync("UserPromptExpansion", {"command_name": name, "command_args": args})
        return str(out.get("reason", "")) or f"/hoja:{name}: unknown command"

    def session_context(self) -> str:
        """The instructions every Hoja plugin adds at session start (TaskManage guidance, Hoja mode rules)."""
        if self._context is not None:
            return self._context
        node = check_node(self.settings)
        payload = {"session_id": self.session_id, "transcript_path": str(self.transcript_path), "cwd": str(self.cwd)}
        try:
            proc = subprocess.run(
                [node, str(bundle_file("session-start.mjs"))],
                input=json.dumps(payload),
                capture_output=True,
                text=True,
                timeout=30,
                env=self.settings.bundle_env(self.cwd),
                cwd=self.cwd,
                check=True,
            )
            out = json.loads(proc.stdout or "{}")
            self._context = str((out.get("hookSpecificOutput") or {}).get("additionalContext", ""))
        except (subprocess.SubprocessError, json.JSONDecodeError, OSError) as error:
            logger.warning("Hoja session context unavailable: %s", error)
            self._context = ""
        return self._context

    # -- internals -------------------------------------------------------------------------------------------------

    def _payload(self, event: str, fields: dict[str, Any]) -> dict[str, Any]:
        return {
            "name": HOOK_TOOL,
            "arguments": {
                "event": event,
                "session_id": self.session_id,
                "transcript_path": str(self.transcript_path),
                "cwd": str(self.cwd),
                **fields,
            },
        }

    async def _hook(self, event: str, fields: dict[str, Any]) -> dict[str, Any]:
        self.start()
        assert self._server is not None
        return _hook_output(await self._server.arequest("tools/call", self._payload(event, fields), timeout=60))

    def _hook_sync(self, event: str, fields: dict[str, Any], timeout: float = 60) -> dict[str, Any]:
        self.start()
        assert self._server is not None
        return _hook_output(self._server.request("tools/call", self._payload(event, fields), timeout=timeout))


def _spec(tool: dict[str, Any], *, hosted: bool) -> ToolSpec:
    schema = tool.get("inputSchema") or {"type": "object", "properties": {}}
    return ToolSpec(name=tool["name"], description=tool.get("description") or "", input_schema=schema, hosted=hosted)


def _hook_output(result: dict[str, Any]) -> dict[str, Any]:
    for part in result.get("content", []):
        if part.get("type") == "text":
            try:
                out = json.loads(part.get("text") or "{}")
            except json.JSONDecodeError:
                return {}
            return out if isinstance(out, dict) else {}
    return {}


def _context(out: dict[str, Any]) -> str:
    return str((out.get("hookSpecificOutput") or {}).get("additionalContext", "") or "")
