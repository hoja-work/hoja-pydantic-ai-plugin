"""The session transcript, written in Claude Code's JSONL format.

The runtime reads the host's transcript for three things: TaskManage evidence (``tool:Bash#3`` must name a real tool
result of this session), the task-gate auto-continue classifier (did the turn end on a hook block?) and session traces
(turns, model calls with token usage, tool spans). A Python host has no transcript the runtime can parse, so the
adapter writes one in the format the runtime already reads, one line per event:

* ``{"type": "user", "message": {"role": "user", "content": "<prompt>"}}``
* ``{"type": "assistant", "message": {"id", "role", "content": [text | tool_use…], "stop_reason", "usage"}}``
* ``{"type": "user", "message": {"role": "user", "content": [{"type": "tool_result", …}]}}``

Writes are appends of whole lines under a lock, so a reader never sees a partial record.
"""

from __future__ import annotations

import json
import threading
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

#: The marker the runtime's auto-continue classifier looks for in a refused tool's result.
BLOCKED_PREFIX = "blocked by hook: "


@dataclass(frozen=True)
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0

    def to_claude(self) -> dict[str, int]:
        return {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "cache_read_input_tokens": self.cache_read_tokens,
            "cache_creation_input_tokens": self.cache_write_tokens,
        }


@dataclass(frozen=True)
class ToolUse:
    id: str
    name: str
    input: dict[str, Any]


class Transcript:
    """Append-only writer for one session's transcript file."""

    def __init__(self, path: Path, session_id: str, cwd: Path) -> None:
        self.path = path
        self.session_id = session_id
        self.cwd = cwd
        self._lock = threading.Lock()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.touch(exist_ok=True)

    def user(self, text: str) -> None:
        self._append("user", {"role": "user", "content": text})

    def assistant(
        self,
        *,
        text: str = "",
        tool_uses: list[ToolUse] | None = None,
        stop_reason: str | None = None,
        usage: Usage | None = None,
        model: str | None = None,
        message_id: str | None = None,
    ) -> str:
        """Record one model response. ``stop_reason`` defaults to ``tool_use`` if it called tools, else ``end_turn``."""
        content: list[dict[str, Any]] = [{"type": "text", "text": text}] if text else []
        content += [{"type": "tool_use", "id": t.id, "name": t.name, "input": t.input} for t in tool_uses or []]
        message_id = message_id or f"msg_{uuid.uuid4().hex}"
        message: dict[str, Any] = {
            "id": message_id,
            "type": "message",
            "role": "assistant",
            "content": content,
            "stop_reason": stop_reason or ("tool_use" if tool_uses else "end_turn"),
        }
        if model:
            message["model"] = model
        if usage:
            message["usage"] = usage.to_claude()
        self._append("assistant", message)
        return message_id

    def tool_result(self, tool_use_id: str, text: str, *, is_error: bool = False) -> None:
        block = {"type": "tool_result", "tool_use_id": tool_use_id, "content": text, "is_error": is_error}
        self._append("user", {"role": "user", "content": [block]})

    def _append(self, kind: str, message: dict[str, Any]) -> None:
        entry = {
            "type": kind,
            "uuid": str(uuid.uuid4()),
            "sessionId": self.session_id,
            "cwd": str(self.cwd),
            "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "message": message,
        }
        line = json.dumps(entry, ensure_ascii=False, default=str) + "\n"
        with self._lock, self.path.open("a", encoding="utf-8") as file:
            file.write(line)


def result_text(value: Any) -> str:
    """A tool result as the text the model saw."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace")
    dump = getattr(value, "model_dump", None)
    if callable(dump):
        value = dump(mode="json")
    try:
        return json.dumps(value, ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        return str(value)
