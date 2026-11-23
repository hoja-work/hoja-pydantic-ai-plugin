"""How tool names cross into the runtime.

The bundled runtime speaks Claude Code's hook dialect, where the policy knows a tool by its Claude Code name: the shell
is ``Bash``, this plugin's own tools are ``mcp__plugin_hoja_hoja__<name>`` and the hosted Hoja API's are
``mcp__plugin_hoja_hoja-api__<name>``. A Python host names the same tools differently, so every name is translated
once, here, before it reaches a hook or the transcript. Evidence such as ``tool:Bash#2`` then resolves the same way
in every Hoja plugin.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

OWN_PREFIX = "mcp__plugin_hoja_hoja__"
API_PREFIX = "mcp__plugin_hoja_hoja-api__"

#: Common Python-agent tool names → the Claude Code tool the runtime's policy knows. Tools not listed keep their name;
#: the policy treats an unknown tool as acting (gated), which is the safe default.
DEFAULT_ALIASES: Mapping[str, str] = {
    # shells
    "shell": "Bash",
    "bash": "Bash",
    "run_shell": "Bash",
    "run_shell_command": "Bash",
    "agent_run_shell_command": "Bash",
    "execute_command": "Bash",
    # reads
    "read_file": "Read",
    "view_file": "Read",
    "list_files": "LS",
    "list_directory": "LS",
    "list_dir": "LS",
    "ls": "LS",
    "grep": "Grep",
    "search_files": "Grep",
    "glob": "Glob",
    "find_files": "Glob",
    # writes
    "write_file": "Write",
    "create_file": "Write",
    "edit_file": "Edit",
    "replace_in_file": "Edit",
    "delete_snippet": "Edit",
    "apply_patch": "Edit",
    # talking to the user is never acting
    "ask_user_question": "AskUserQuestion",
}

#: Argument names a shell tool may use for its command line. The policy reads ``command``.
_COMMAND_KEYS = ("command", "cmd", "script", "commandLine")


@dataclass
class ToolNames:
    """Translates host tool names. ``own`` and ``api`` are filled in when the runtime lists its tools."""

    aliases: Mapping[str, str] = field(default_factory=lambda: dict(DEFAULT_ALIASES))
    own: set[str] = field(default_factory=set)
    api: set[str] = field(default_factory=set)

    def bridge(self, name: str) -> str:
        """The name the runtime (and the transcript) knows ``name`` by."""
        if name in self.own:
            return OWN_PREFIX + name
        if name in self.api:
            return API_PREFIX + name
        return self.aliases.get(name, name)

    def is_hoja(self, name: str) -> bool:
        return name in self.own or name in self.api


def bridge_args(bridged_name: str, args: Any) -> dict[str, Any]:
    """Tool arguments as the runtime expects them: always an object, and ``Bash`` always carries ``command``."""
    if not isinstance(args, Mapping):
        return {"input": args} if args is not None else {}
    out = dict(args)
    if bridged_name == "Bash" and not isinstance(out.get("command"), str):
        for key in _COMMAND_KEYS[1:]:
            if isinstance(out.get(key), str):
                out["command"] = out[key]
                break
    return out
