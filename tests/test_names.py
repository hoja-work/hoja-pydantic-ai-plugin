import pytest

from pydantic_ai_hoja.runtime.names import API_PREFIX, OWN_PREFIX, ToolNames, bridge_args


@pytest.mark.parametrize(
    ("host", "bridged"),
    [
        ("shell", "Bash"),
        ("agent_run_shell_command", "Bash"),
        ("read_file", "Read"),
        ("grep", "Grep"),
        ("list_files", "LS"),
        ("create_file", "Write"),
        ("replace_in_file", "Edit"),
        ("deploy", "deploy"),
    ],
)
def test_host_tools_map_to_claude_names(host: str, bridged: str) -> None:
    assert ToolNames().bridge(host) == bridged


def test_hoja_tools_get_plugin_prefixes() -> None:
    names = ToolNames(own={"TaskManage"}, api={"hoja_issues"})
    assert names.bridge("TaskManage") == OWN_PREFIX + "TaskManage"
    assert names.bridge("hoja_issues") == API_PREFIX + "hoja_issues"
    assert names.is_hoja("hoja_issues")
    assert not names.is_hoja("shell")


def test_bash_always_carries_command() -> None:
    assert bridge_args("Bash", {"cmd": "ls"}) == {"cmd": "ls", "command": "ls"}
    assert bridge_args("Bash", {"command": "pwd"}) == {"command": "pwd"}
    assert bridge_args("Read", "x") == {"input": "x"}
    assert bridge_args("Read", None) == {}
