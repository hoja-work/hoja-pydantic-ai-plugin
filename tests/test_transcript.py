import json
from pathlib import Path

from pydantic_ai_hoja.runtime.transcript import ToolUse, Transcript, Usage, result_text


def test_lines_use_claude_code_shapes(tmp_path: Path) -> None:
    t = Transcript(tmp_path / "t.jsonl", "s1", tmp_path)
    t.user("hi")
    mid = t.assistant(
        text="on it",
        usage=Usage(input_tokens=10, output_tokens=2),
        tool_uses=[ToolUse("c1", "Bash", {"command": "ls"})],
    )
    t.tool_result("c1", "a.txt")
    t.assistant(text="done")
    lines = [json.loads(line) for line in (tmp_path / "t.jsonl").read_text().splitlines()]
    assert [e["type"] for e in lines] == ["user", "assistant", "user", "assistant"]
    assert lines[1]["message"]["id"] == mid
    assert lines[1]["message"]["stop_reason"] == "tool_use"
    assert lines[1]["message"]["usage"]["input_tokens"] == 10
    assert lines[1]["message"]["content"][1] == {
        "type": "tool_use",
        "id": "c1",
        "name": "Bash",
        "input": {"command": "ls"},
    }
    assert lines[2]["message"]["content"][0]["tool_use_id"] == "c1"
    assert lines[3]["message"]["stop_reason"] == "end_turn"
    assert all(e["sessionId"] == "s1" for e in lines)


def test_result_text() -> None:
    assert result_text(None) == ""
    assert result_text("x") == "x"
    assert result_text({"a": 1}) == '{"a": 1}'
    assert result_text(b"\xff") == "�"
