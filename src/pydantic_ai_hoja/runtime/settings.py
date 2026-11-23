"""Configuration: the same ``HOJA_*`` variables every Hoja plugin reads, plus a few Python-host options."""

from __future__ import annotations

import os
import shutil
from collections.abc import Mapping
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Literal

Enforcement = Literal["block", "advise", "off"]
TraceUpload = Literal["completion", "session-end", "manual", "off"]
TraceDetail = Literal["full", "metadata"]

_TRUE = {"1", "true", "yes", "on"}

#: Variables of the hosts the bundle was built for. Inherited by accident (for example when this runs inside Claude
#: Code), they would change the bundle's data directory or its headless semantics, so they never reach it.
_FOREIGN_ENV_PREFIXES = ("CLAUDE_PLUGIN_", "CLAUDE_CODE_", "CODEX_", "HOJA_PLUGIN_")
_FOREIGN_ENV = {"CLAUDE_PROJECT_DIR", "PLUGIN_DATA", "PLUGIN_ROOT"}


def _truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in _TRUE


def _first(env: Mapping[str, str], *names: str) -> str | None:
    for name in names:
        value = env.get(name, "").strip()
        if value:
            return value
    return None


def default_data_dir(env: Mapping[str, str] = os.environ) -> Path:
    """``$XDG_DATA_HOME/hoja/pydantic-ai`` (``~/.local/share/hoja/pydantic-ai``)."""
    base = env.get("XDG_DATA_HOME", "").strip() or str(Path.home() / ".local" / "share")
    return Path(base) / "hoja" / "pydantic-ai"


@dataclass(frozen=True, kw_only=True)
class HojaSettings:
    """Everything the Hoja runtime needs. Build it with :meth:`from_env` and adjust with :meth:`replace`.

    Credentials are optional. Without them TaskManage and the task gate still work; publication to Hoja is skipped.
    With none set here, the bundle asks the Hoja CLI (``hoja auth token --json``) for the signed-in workspace.
    """

    api_url: str | None = None
    """Hoja GraphQL endpoint, e.g. ``https://acme.hoja.work/graphql`` (``HOJA_API_URL``)."""
    mcp_url: str | None = None
    """Hosted MCP endpoint (``HOJA_MCP_URL``). Derived from the GraphQL host when unset."""
    token: str | None = field(default=None, repr=False)
    """Personal API token (``HOJA_TOKEN``)."""
    project: str | None = None
    """Default project for publication (``HOJA_PROJECT``). Also ``.pi/config/hoja.json`` in the repository."""
    enforcement: Enforcement = "block"
    """``block`` refuses acting tools until a task is focused, ``advise`` only nudges, ``off`` disables the gate."""
    trace_upload: TraceUpload = "completion"
    trace_detail: TraceDetail = "full"
    hoja_mode: bool = True
    """Publish coarse tasks to Hoja. ``False`` keeps TaskManage and the gate local (``HOJA_PLUGIN_DISABLE_HOJA=1``)."""
    hosted_api: bool = True
    """Also expose the workspace's hosted MCP API (70+ ``hoja_*`` tools). Read tools are exempt from the gate."""
    headless: bool = False
    """Non-interactive semantics (``swarm -p``): the gate judges each prompt as a fresh unattended job."""
    data_dir: Path = field(default_factory=default_data_dir)
    """Task journals, transcripts and traces. One directory per host keeps sessions apart."""
    node: str = "node"
    """The Node.js (>= 22) executable that runs the bundled runtime."""
    debug_log: str | None = None
    """Append every hook and tool call the runtime receives to this file (``HOJA_DEBUG_LOG``)."""

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None, **overrides: object) -> HojaSettings:
        """Read ``HOJA_*`` variables (and the deprecated ``LINEAR_*`` aliases), then apply ``overrides``."""
        env = os.environ if env is None else env
        enforcement = (_first(env, "HOJA_TASK_ENFORCEMENT") or "block").lower()
        upload = (_first(env, "HOJA_TRACE_UPLOAD") or "completion").lower()
        settings = cls(
            api_url=_first(env, "HOJA_API_URL", "LINEAR_API_URL"),
            mcp_url=_first(env, "HOJA_MCP_URL"),
            token=_first(env, "HOJA_TOKEN", "LINEAR_TOKEN"),
            project=_first(env, "HOJA_PROJECT"),
            enforcement=enforcement if enforcement in ("advise", "off") else "block",  # type: ignore[arg-type]
            trace_upload=upload if upload in ("session-end", "manual", "off") else "completion",  # type: ignore[arg-type]
            trace_detail="metadata" if (_first(env, "HOJA_TRACE_DETAIL") or "").lower() == "metadata" else "full",
            hoja_mode=not _truthy(env.get("HOJA_PLUGIN_DISABLE_HOJA")),
            hosted_api=not _truthy(env.get("HOJA_DISABLE_HOSTED_API")),
            headless=_truthy(env.get("HOJA_HEADLESS")),
            data_dir=Path(_first(env, "HOJA_DATA_DIR") or default_data_dir(env)).expanduser(),
            node=_first(env, "HOJA_NODE") or "node",
            debug_log=_first(env, "HOJA_DEBUG_LOG"),
        )
        return settings.replace(**overrides) if overrides else settings

    def replace(self, **changes: object) -> HojaSettings:
        if "data_dir" in changes and changes["data_dir"] is not None:
            changes["data_dir"] = Path(str(changes["data_dir"])).expanduser()
        return replace(self, **changes)  # type: ignore[arg-type]

    def node_path(self) -> str | None:
        return shutil.which(self.node)

    def bundle_env(self, cwd: Path, base: Mapping[str, str] | None = None) -> dict[str, str]:
        """The environment for a bundle process: the caller's, minus other hosts' variables, plus these settings."""
        source = os.environ if base is None else base
        env = {k: v for k, v in source.items() if k not in _FOREIGN_ENV and not k.startswith(_FOREIGN_ENV_PREFIXES)}
        for name in ("HOJA_API_URL", "HOJA_MCP_URL", "HOJA_TOKEN", "HOJA_PROJECT", "LINEAR_TOKEN", "LINEAR_API_URL"):
            env.pop(name, None)
        values = {
            "HOJA_API_URL": self.api_url,
            "HOJA_MCP_URL": self.mcp_url,
            "HOJA_TOKEN": self.token,
            "HOJA_PROJECT": self.project,
            "HOJA_TASK_ENFORCEMENT": self.enforcement,
            "HOJA_TRACE_UPLOAD": self.trace_upload,
            "HOJA_TRACE_DETAIL": self.trace_detail,
            "HOJA_PLUGIN_DATA": str(self.data_dir),
            "HOJA_PLUGIN_HEADLESS": "1" if self.headless else None,
            "HOJA_PLUGIN_DISABLE_HOJA": None if self.hoja_mode else "1",
            "HOJA_PLUGIN_UPDATE_CHECK": "off",  # the bundle would check the Claude Code plugin's version
            "HOJA_DEBUG_LOG": self.debug_log,
            "CLAUDE_PROJECT_DIR": str(cwd),
        }
        env.update({k: v for k, v in values.items() if v})
        return env
