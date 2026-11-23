"""End to end: a scripted model, a real agent, the real bundled runtime."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic_ai import Agent
from pydantic_ai.messages import UserPromptPart

from pydantic_ai_hoja import Hoja, HojaSettings

from .conftest import requires_node
from .scripted import Script, call, complete_task, create_task, say

pytestmark = [requires_node, pytest.mark.runtime]


def make_agent(script: Script, hoja: Hoja, workspace: Path) -> Agent[None, str]:
    agent = Agent(script.model(), capabilities=[hoja])

    @agent.tool_plain
    def shell(command: str) -> str:
        """Run a shell command in the workspace."""
        import subprocess

        done = subprocess.run(command, shell=True, cwd=workspace, capture_output=True, text=True, check=False)
        return done.stdout or "(no output)"

    return agent


@pytest.fixture
def hoja(settings: HojaSettings, workspace: Path):
    capability = Hoja(settings=settings, cwd=workspace)
    yield capability
    capability.close()


def test_gate_blocks_until_a_task_is_focused_then_accepts_real_evidence(hoja: Hoja, workspace: Path) -> None:
    script = Script(
        [
            call("shell", {"command": "touch proof.txt"}, "c1"),
            create_task("c2"),
            call("shell", {"command": "touch proof.txt"}, "c3"),
            complete_task("c4", "tool:Bash#2"),
            say("Done."),
        ]
    )
    result = make_agent(script, hoja, workspace).run_sync("Create proof.txt")

    assert result.output == "Done."
    blocked, allowed = script.saw(lambda s: s.startswith("shell:"))
    assert "blocked by hook" in blocked
    assert "TASK ENFORCEMENT" in blocked
    assert allowed == "shell: (no output)"
    assert (workspace / "proof.txt").exists()
    completion = json.loads(script.seen[-1].removeprefix("TaskManage: "))
    assert completion["status"] == "succeeded"
    assert "✓ #1 Create proof.txt [completed]" in hoja.command("tasks")


def test_made_up_evidence_is_rejected(hoja: Hoja, workspace: Path) -> None:
    script = Script([create_task("c1"), complete_task("c2", "tool:Write#7"), say("Done.")])
    make_agent(script, hoja, workspace).run_sync("Create proof.txt")
    rejection = script.seen[-1]
    assert rejection.startswith("TaskManage:")
    assert "succeeded" not in json.loads(rejection.removeprefix("TaskManage: "))["status"]
    assert "[completed]" not in hoja.command("tasks")


def test_file_evidence_resolves_against_the_workspace(hoja: Hoja, workspace: Path) -> None:
    script = Script([create_task("c1"), complete_task("c2", "README.md#Install"), say("Done.")])
    make_agent(script, hoja, workspace).run_sync("Document the install")
    assert json.loads(script.seen[-1].removeprefix("TaskManage: "))["status"] == "succeeded"


def test_turn_that_ends_on_a_block_is_sent_back(hoja: Hoja, workspace: Path) -> None:
    script = Script(
        [
            call("shell", {"command": "touch proof.txt"}, "c1"),
            say("I was blocked, stopping."),
            create_task("c2"),
            call("shell", {"command": "touch proof.txt"}, "c3"),
            say("Done."),
        ]
    )
    agent = make_agent(script, hoja, workspace)
    result = agent.run_sync("Create proof.txt")
    assert result.output == "Done."
    continuations = [
        part.content
        for request in script.requests
        for part in request.parts
        if isinstance(part, UserPromptPart) and "AUTO-CONTINUE 1/" in str(part.content)
    ]
    assert len(continuations) == 1
    assert (workspace / "proof.txt").exists()


def test_reads_are_never_gated(hoja: Hoja, workspace: Path) -> None:
    script = Script([call("shell", {"command": "ls"}, "c1"), say("Listed.")])
    make_agent(script, hoja, workspace).run_sync("What is here?")
    assert script.seen == ["shell: README.md\n"]


def test_local_commands_skip_the_model(hoja: Hoja, workspace: Path) -> None:
    script = Script([])
    result = make_agent(script, hoja, workspace).run_sync("/hoja:tasks")
    assert "Tasks" in result.output
    assert script.requests == []


def test_advise_mode_never_blocks(settings: HojaSettings, workspace: Path) -> None:
    hoja = Hoja(settings=settings.replace(enforcement="advise"), cwd=workspace)
    try:
        script = Script([call("shell", {"command": "touch proof.txt"}, "c1"), say("Done.")])
        make_agent(script, hoja, workspace).run_sync("Create proof.txt")
        assert (workspace / "proof.txt").exists()
    finally:
        hoja.close()


def test_instructions_teach_taskmanage(hoja: Hoja, workspace: Path) -> None:
    script = Script([say("ok")])
    make_agent(script, hoja, workspace).run_sync("hello")
    instructions = script.requests[0].instructions or ""
    assert "TaskManage" in instructions
    assert "task_completion_contract" in instructions


def test_tools_come_from_the_runtime(hoja: Hoja) -> None:
    names = {spec.name for spec in hoja.hoja.tools()}
    assert {"TaskManage", "hoja_setup", "hoja_trace"} <= names


def test_transcript_records_the_turn(hoja: Hoja, workspace: Path) -> None:
    script = Script([create_task("c1"), say("Done.")])
    make_agent(script, hoja, workspace).run_sync("Plan it")
    lines = [json.loads(line) for line in hoja.hoja.transcript_path.read_text().splitlines()]
    kinds = [(e["type"], e["message"].get("stop_reason")) for e in lines]
    assert kinds[0] == ("user", None)
    assert ("assistant", "tool_use") in kinds
    assert kinds[-1] == ("assistant", "end_turn")
    tool_use = next(
        b
        for e in lines
        for b in (e["message"]["content"] if isinstance(e["message"]["content"], list) else [])
        if b.get("type") == "tool_use"
    )
    assert tool_use["name"] == "mcp__plugin_hoja_hoja__TaskManage"
