"""A small JSON-RPC 2.0 client for an MCP server over stdio (newline-delimited messages).

It runs the reader on a thread, so one connection serves any number of event loops and synchronous callers. That
matters here: ``Agent.run_sync`` starts a fresh loop per call, and Code Puppy fires some plugin callbacks
synchronously. An ``asyncio`` subprocess would be bound to the loop that created it.
"""

from __future__ import annotations

import asyncio
import contextlib
import itertools
import json
import logging
import subprocess
import threading
from collections.abc import Callable, Mapping, Sequence
from concurrent.futures import Future
from pathlib import Path
from typing import Any

logger = logging.getLogger("pydantic_ai_hoja.rpc")

Json = dict[str, Any]
#: Answers a request the server sends to the client (MCP elicitation). Runs on a worker thread.
RequestHandler = Callable[[str, Json], Json]

PROTOCOL_VERSION = "2025-06-18"


class RpcError(RuntimeError):
    """The server answered with an error, exited, or did not answer in time."""


class StdioRpc:
    """One child process speaking MCP over stdio. Thread-safe; start it once, then call from anywhere."""

    def __init__(
        self,
        argv: Sequence[str],
        *,
        name: str,
        env: Mapping[str, str] | None = None,
        cwd: Path | None = None,
        on_request: RequestHandler | None = None,
        client_capabilities: Json | None = None,
        timeout: float = 120.0,
    ) -> None:
        self.argv = list(argv)
        self.name = name
        self.env = dict(env) if env is not None else None
        self.cwd = cwd
        self.on_request = on_request
        self.client_capabilities = client_capabilities or {}
        self.timeout = timeout
        self.server_info: Json = {}
        self._proc: subprocess.Popen[str] | None = None
        self._ids = itertools.count(1)
        self._pending: dict[int, Future[Json]] = {}
        self._write_lock = threading.Lock()
        self._start_lock = threading.Lock()
        self._closed = False

    @property
    def running(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    def start(self) -> None:
        """Spawn the server and complete the MCP handshake. Idempotent."""
        with self._start_lock:
            if self.running:
                return
            if self._closed:
                raise RpcError(f"{self.name}: connection was closed")
            self._proc = subprocess.Popen(
                self.argv,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                bufsize=1,
                env=self.env,
                cwd=self.cwd,
            )
            threading.Thread(target=self._read_stdout, name=f"hoja-{self.name}-rpc", daemon=True).start()
            threading.Thread(target=self._read_stderr, name=f"hoja-{self.name}-log", daemon=True).start()
            init = self.request(
                "initialize",
                {
                    "protocolVersion": PROTOCOL_VERSION,
                    "capabilities": self.client_capabilities,
                    "clientInfo": {"name": "pydantic-ai-hoja", "version": _version()},
                },
            )
            self.server_info = init.get("serverInfo", {})
            self.notify("notifications/initialized", {})

    def request(self, method: str, params: Json, timeout: float | None = None) -> Json:
        """Send a request and block until its result."""
        return self.submit(method, params).result(timeout=timeout or self.timeout)

    async def arequest(self, method: str, params: Json, timeout: float | None = None) -> Json:
        """Send a request and await its result on the current loop."""
        return await asyncio.wait_for(asyncio.wrap_future(self.submit(method, params)), timeout or self.timeout)

    def submit(self, method: str, params: Json) -> Future[Json]:
        future: Future[Json] = Future()
        if not self.running:
            future.set_exception(RpcError(f"{self.name}: server is not running"))
            return future
        request_id = next(self._ids)
        self._pending[request_id] = future
        try:
            self._send({"jsonrpc": "2.0", "id": request_id, "method": method, "params": params})
        except OSError as error:
            self._pending.pop(request_id, None)
            future.set_exception(RpcError(f"{self.name}: {error}"))
        return future

    def notify(self, method: str, params: Json) -> None:
        self._send({"jsonrpc": "2.0", "method": method, "params": params})

    def close(self, timeout: float = 5.0) -> None:
        """Close stdin (the server flushes its session on EOF) and wait for it to exit."""
        self._closed = True
        proc = self._proc
        if proc is None:
            return
        try:
            if proc.stdin and not proc.stdin.closed:
                proc.stdin.close()
            proc.wait(timeout=timeout)
        except (OSError, subprocess.TimeoutExpired):
            proc.kill()
        finally:
            self._fail_pending(RpcError(f"{self.name}: connection closed"))

    # -- internals -------------------------------------------------------------------------------------------------

    def _send(self, message: Json) -> None:
        proc = self._proc
        if proc is None or proc.stdin is None:
            raise OSError("not started")
        line = json.dumps(message, ensure_ascii=False) + "\n"
        with self._write_lock:
            proc.stdin.write(line)
            proc.stdin.flush()

    def _read_stdout(self) -> None:
        proc = self._proc
        assert proc is not None
        assert proc.stdout is not None
        for line in proc.stdout:
            if not line.strip():
                continue
            try:
                message = json.loads(line)
            except json.JSONDecodeError:
                logger.debug("%s: ignoring non-JSON line %r", self.name, line[:200])
                continue
            if "method" in message and "id" in message:
                threading.Thread(target=self._answer, args=(message,), daemon=True).start()
            elif "id" in message:
                future = self._pending.pop(message["id"], None)
                if future is None:
                    continue
                if "error" in message:
                    error = message["error"] or {}
                    future.set_exception(RpcError(f"{self.name}: {error.get('message', error)}"))
                else:
                    future.set_result(message.get("result") or {})
        self._fail_pending(RpcError(f"{self.name}: server exited (code {proc.poll()})"))

    def _read_stderr(self) -> None:
        proc = self._proc
        assert proc is not None
        assert proc.stderr is not None
        for line in proc.stderr:
            logger.debug("%s: %s", self.name, line.rstrip())

    def _answer(self, message: Json) -> None:
        method, params = str(message.get("method")), message.get("params") or {}
        try:
            if method == "ping":
                result: Json = {}
            elif self.on_request is not None:
                result = self.on_request(method, params)
            else:
                result = {"action": "cancel"} if method == "elicitation/create" else {}
            self._send({"jsonrpc": "2.0", "id": message["id"], "result": result})
        except Exception as error:  # an answer must always go back, or the server waits forever
            logger.warning("%s: answering %s failed: %s", self.name, method, error)
            with contextlib.suppress(OSError):
                self._send({"jsonrpc": "2.0", "id": message["id"], "error": {"code": -32603, "message": str(error)}})

    def _fail_pending(self, error: RpcError) -> None:
        pending, self._pending = self._pending, {}
        for future in pending.values():
            if not future.done():
                future.set_exception(error)


def _version() -> str:
    from .._version import __version__

    return __version__
