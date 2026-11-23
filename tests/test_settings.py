from pathlib import Path

from pydantic_ai_hoja import HojaSettings


def test_from_env_reads_hoja_variables_and_aliases() -> None:
    s = HojaSettings.from_env(
        {
            "LINEAR_API_URL": "https://acme.hoja.work/graphql",
            "HOJA_TOKEN": "tok",
            "HOJA_PROJECT": "Team",
            "HOJA_TASK_ENFORCEMENT": "advise",
            "HOJA_TRACE_UPLOAD": "manual",
            "HOJA_TRACE_DETAIL": "metadata",
            "HOJA_PLUGIN_DISABLE_HOJA": "1",
            "HOJA_DISABLE_HOSTED_API": "true",
            "HOJA_DATA_DIR": "/tmp/hoja-x",
        }
    )
    assert s.api_url == "https://acme.hoja.work/graphql"
    assert (s.token, s.project, s.enforcement) == ("tok", "Team", "advise")
    assert (s.trace_upload, s.trace_detail) == ("manual", "metadata")
    assert not s.hoja_mode
    assert not s.hosted_api
    assert s.data_dir == Path("/tmp/hoja-x")


def test_unknown_values_fall_back_to_safe_defaults() -> None:
    s = HojaSettings.from_env({"HOJA_TASK_ENFORCEMENT": "nope", "HOJA_TRACE_UPLOAD": "??"})
    assert s.enforcement == "block"
    assert s.trace_upload == "completion"
    assert s.hoja_mode
    assert s.hosted_api


def test_token_is_not_in_repr() -> None:
    assert "secret" not in repr(HojaSettings(token="secret"))


def test_bundle_env_drops_other_hosts_variables(tmp_path: Path) -> None:
    base = {
        "PATH": "/usr/bin",
        "CLAUDE_PLUGIN_DATA": "/elsewhere",
        "CLAUDE_CODE_ENTRYPOINT": "sdk-py",
        "PLUGIN_DATA": "/x",
        "HOJA_PLUGIN_HEADLESS": "1",
        "HOJA_TOKEN": "from-env",
    }
    env = HojaSettings(data_dir=tmp_path, token="mine").bundle_env(tmp_path, base)
    assert env["PATH"] == "/usr/bin"
    assert "CLAUDE_PLUGIN_DATA" not in env
    assert "CLAUDE_CODE_ENTRYPOINT" not in env
    assert "PLUGIN_DATA" not in env
    assert "HOJA_PLUGIN_HEADLESS" not in env
    assert env["HOJA_TOKEN"] == "mine"
    assert env["HOJA_PLUGIN_DATA"] == str(tmp_path)
    assert env["CLAUDE_PROJECT_DIR"] == str(tmp_path)
    assert env["HOJA_PLUGIN_UPDATE_CHECK"] == "off"


def test_replace_expands_user_paths() -> None:
    assert HojaSettings().replace(data_dir="~/x").data_dir == Path.home() / "x"
