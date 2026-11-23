"""A small coding agent managed by Hoja. Try it with clai:

    uvx --with pydantic-ai-hoja clai --agent examples.coding_agent:agent

or run this file directly:

    uv run python examples/coding_agent.py "Add a CHANGELOG entry for 0.1.0"

The model defaults to ``HOJA_EXAMPLE_MODEL`` or ``anthropic:claude-sonnet-4-5``.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from pydantic_ai import Agent

from pydantic_ai_hoja import Hoja

WORKSPACE = Path.cwd()

agent = Agent(
    os.environ.get("HOJA_EXAMPLE_MODEL", "anthropic:claude-sonnet-4-5"),
    instructions="You are a careful coding agent working in the current directory.",
    capabilities=[Hoja(cwd=WORKSPACE)],
)


@agent.tool_plain
def shell(command: str) -> str:
    """Run a shell command in the workspace and return its output (stdout, then stderr)."""
    done = subprocess.run(command, shell=True, cwd=WORKSPACE, capture_output=True, text=True, timeout=300, check=False)
    output = (done.stdout + done.stderr).strip() or "(no output)"
    return output if done.returncode == 0 else f"exit {done.returncode}\n{output}"


@agent.tool_plain
def read_file(path: str) -> str:
    """Read a UTF-8 text file in the workspace."""
    return (WORKSPACE / path).read_text()


if __name__ == "__main__":
    prompt = " ".join(sys.argv[1:]) or "/hoja:tasks"
    print(agent.run_sync(prompt).output)
