"""A scripted model: each step returns the next response and records what the model saw."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    RetryPromptPart,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
)
from pydantic_ai.models.function import AgentInfo, FunctionModel


def call(tool: str, args: dict[str, Any], call_id: str) -> ModelResponse:
    return ModelResponse(parts=[ToolCallPart(tool, args, tool_call_id=call_id)])


def say(text: str) -> ModelResponse:
    return ModelResponse(parts=[TextPart(text)])


def create_task(call_id: str, subject: str = "Create proof.txt") -> ModelResponse:
    op = {
        "key": "t",
        "op": "create",
        "subject": subject,
        "status": "in_progress",
        "active": True,
        "questions": [{"id": "f", "text": "Does proof.txt exist?"}],
    }
    return call("TaskManage", {"operations": [op]}, call_id)


def complete_task(call_id: str, evidence: str, task_id: str = "1") -> ModelResponse:
    op = {
        "key": "d",
        "op": "update",
        "taskId": task_id,
        "status": "completed",
        "answers": [{"question": "f", "answer": "yes", "evidence": evidence}],
    }
    return call("TaskManage", {"operations": [op]}, call_id)


@dataclass
class Script:
    steps: list[ModelResponse]
    seen: list[str] = field(default_factory=list)
    """Every tool return and retry prompt, as ``"<tool>: <content>"``, in order."""
    requests: list[ModelRequest] = field(default_factory=list)

    def model(self) -> FunctionModel:
        return FunctionModel(self._respond)

    def _respond(self, messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        last = messages[-1]
        if isinstance(last, ModelRequest):
            self.requests.append(last)
            for part in last.parts:
                if isinstance(part, (ToolReturnPart, RetryPromptPart)):
                    self.seen.append(f"{part.tool_name}: {part.content}")
        return self.steps.pop(0) if self.steps else say("Done.")

    def saw(self, predicate: Callable[[str], bool]) -> list[str]:
        return [s for s in self.seen if predicate(s)]
