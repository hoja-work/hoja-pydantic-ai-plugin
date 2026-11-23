"""``Hoja``: the Pydantic AI capability.

One line turns any agent into a Hoja-managed agent::

    agent = Agent("anthropic:claude-sonnet-4-5", capabilities=[Hoja()])

It contributes three things and hooks four seams of the agent loop:

* **tools**: TaskManage and the Hoja tools, served by the runtime (:mod:`pydantic_ai_hoja.toolset`);
* **instructions**: the TaskManage workflow and, in Hoja mode, the publication rules;
* **task gate** (``wrap_tool_execute``): every other tool call is checked first; a refused call returns the reason
  instead of running;
* **transcript and nudges** (``before_run``, ``before_model_request``, ``after_model_request``): each turn is
  recorded so evidence like ``tool:Bash#2`` resolves, and the runtime's reminders reach the model;
* **auto-continue** (``after_model_request``): when the model ends its turn on a gate block the runtime can resolve,
  it is sent back with exactly what to do, within the runtime's own bounded budget.
"""

from __future__ import annotations

import asyncio
import copy
import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.exceptions import ApprovalRequired, CallDeferred
from pydantic_ai.messages import ModelResponse, TextPart, ToolCallPart
from pydantic_ai.models import ModelRequestContext
from pydantic_ai.run import AgentRunResult
from pydantic_ai.toolsets import FunctionToolset

from .runtime.names import DEFAULT_ALIASES, ToolNames
from .runtime.session import HojaSession
from .runtime.settings import HojaSettings
from .runtime.transcript import Usage
from .toolset import ToolErrorText, hoja_toolset

logger = logging.getLogger("pydantic_ai_hoja")


@dataclass(kw_only=True)
class Hoja(AbstractCapability[Any]):
    """Tasks that can't be marked done without proof, for any Pydantic AI agent.

    Every argument is optional. Credentials come from ``HOJA_*`` variables or the Hoja CLI's sign-in; without them
    TaskManage and the gate still work and publication to Hoja is skipped.
    """

    id: str | None = "hoja"
    settings: HojaSettings | None = None
    """Configuration. Defaults to :meth:`HojaSettings.from_env`."""
    session: HojaSession | None = None
    """Share one session between agents (a coordinator and its subagents). Defaults to a new session."""
    cwd: Path | str | None = None
    """The workspace evidence like ``src/app.py#L10-L20`` resolves against. Defaults to the current directory."""
    tool_aliases: Mapping[str, str] = field(default_factory=dict)
    """Extra ``{your_tool: ClaudeCodeName}`` mappings, e.g. ``{"run": "Bash"}``, merged over the defaults."""
    gate: bool = True
    """Check every tool call with the task gate. ``False`` keeps the tools, instructions and transcript only."""
    auto_continue: bool = True
    """Send the model back to work when its turn ended on a gate block the runtime can resolve."""
    include_tools: bool = True
    include_instructions: bool = True

    _pending: list[str] = field(default_factory=list, init=False, repr=False)
    _tools_ran: bool = field(default=False, init=False, repr=False)
    _toolset: FunctionToolset[Any] | None = field(default=None, init=False, repr=False)

    def __post_init__(self) -> None:
        if self.session is None:
            names = ToolNames(aliases={**DEFAULT_ALIASES, **self.tool_aliases})
            self.session = HojaSession(
                settings=self.settings or HojaSettings.from_env(), cwd=Path(self.cwd or Path.cwd()), names=names
            )
        elif self.tool_aliases:
            self.session.names.aliases = {**self.session.names.aliases, **self.tool_aliases}

    @property
    def hoja(self) -> HojaSession:
        assert self.session is not None
        return self.session

    @classmethod
    def get_serialization_name(cls) -> str | None:
        return "Hoja"

    # -- configuration -----------------------------------------------------------------------------------------------

    def get_instructions(self) -> Any:
        if not self.include_instructions:
            return None

        async def hoja_instructions(ctx: RunContext[Any]) -> str:
            return await asyncio.to_thread(self.hoja.session_context)

        return hoja_instructions

    def get_toolset(self) -> Any:
        if not self.include_tools:
            return None

        async def hoja_tools(ctx: RunContext[Any]) -> FunctionToolset[Any]:
            if self._toolset is None:
                self._toolset = await asyncio.to_thread(hoja_toolset, self.hoja)
            return self._toolset

        return hoja_tools

    async def for_run(self, ctx: RunContext[Any]) -> Hoja:
        run = copy.copy(self)  # shares the session and the built toolset; per-run state starts empty
        run._pending = []
        run._tools_ran = False
        return run

    def command(self, name: str, args: str = "") -> str:
        """Run a local command: ``tasks``, ``hoja on|off|status``, ``trace [upload ISSUE|path]``, ``setup``."""
        return self.hoja.command(name, args)

    def close(self) -> None:
        """End the session (flushes the task journal and the trace). Also runs at interpreter exit."""
        self.hoja.close()

    # -- run lifecycle -----------------------------------------------------------------------------------------------

    async def wrap_run(self, ctx: RunContext[Any], *, handler: Any) -> AgentRunResult[Any]:
        prompt = _prompt_text(ctx.prompt)
        if prompt is not None:
            decision = await self.hoja.user_prompt(prompt)
            if decision.command_output is not None:
                # `/hoja:tasks` and friends are answered locally, like every Hoja plugin: no model turn.
                return AgentRunResult(output=decision.command_output)
            if decision.context:
                self._pending.append(decision.context)
        return await handler()

    async def before_model_request(
        self, ctx: RunContext[Any], request_context: ModelRequestContext
    ) -> ModelRequestContext:
        if self._tools_ran:
            self._tools_ran = False
            if context := await self.hoja.tool_batch_end():
                self._pending.append(context)
        if self._pending:
            ctx.enqueue("\n\n".join(self._pending))
            self._pending.clear()
        return request_context

    async def after_model_request(
        self, ctx: RunContext[Any], *, request_context: ModelRequestContext, response: ModelResponse
    ) -> ModelResponse:
        text = "".join(p.content for p in response.parts if isinstance(p, TextPart))
        calls = [p for p in response.parts if isinstance(p, ToolCallPart)]
        usage = response.usage
        self.hoja.model_response(
            text=text,
            tool_calls=bool(calls),
            model=response.model_name,
            message_id=response.provider_response_id,
            usage=Usage(
                input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens,
                cache_read_tokens=usage.cache_read_tokens,
                cache_write_tokens=usage.cache_write_tokens,
            ),
        )
        if not calls and self.auto_continue:
            decision = await self.hoja.stop(text)
            if decision.notice:
                logger.warning("%s", decision.notice)
            if decision.continue_with:
                # Pi's followUp: an `asap` message enqueued when the agent would otherwise end redirects the run
                # instead. Unlike ModelRetry it spends no output-retry budget; the runtime bounds it on its own.
                ctx.enqueue(decision.continue_with)
        return response

    # -- the task gate -----------------------------------------------------------------------------------------------

    async def wrap_tool_execute(
        self, ctx: RunContext[Any], *, call: ToolCallPart, tool_def: Any, args: Any, handler: Any
    ) -> Any:
        if not self.gate:
            return await handler(args)
        call_id = call.tool_call_id
        decision = await self.hoja.pre_tool(call.tool_name, args, call_id=call_id)
        self._tools_ran = True
        if decision.blocked:
            return decision.blocked_result
        try:
            result = await handler(args)
        except (CallDeferred, ApprovalRequired):
            raise
        except Exception as error:
            if context := await self.hoja.post_tool(call_id, str(error), failed=True):
                self._pending.append(context)
            raise
        if context := await self.hoja.post_tool(call_id, result, failed=isinstance(result, ToolErrorText)):
            self._pending.append(context)
        if decision.context:
            # Pi prefixes pre-tool context onto the result; a structured result keeps its shape and the context
            # reaches the model with the next request instead.
            if isinstance(result, str):
                return f"{decision.context}\n\n{result}"
            self._pending.append(decision.context)
        return result


def _prompt_text(prompt: str | Sequence[Any] | None) -> str | None:
    if prompt is None:
        return None
    if isinstance(prompt, str):
        return prompt
    return "\n".join(p for p in prompt if isinstance(p, str)) or None
