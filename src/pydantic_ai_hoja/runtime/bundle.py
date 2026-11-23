"""The vendored runtime bundle and the Node.js that runs it."""

from __future__ import annotations

import json
import re
import subprocess
from functools import cache
from importlib.resources import files
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .settings import HojaSettings

#: The bundle uses Node 22 APIs (``fetch``, ``AbortSignal.timeout``, stable ``fs`` promises).
MIN_NODE_MAJOR = 22


def bundle_dir() -> Path:
    return Path(str(files("pydantic_ai_hoja") / "_bundle"))


def bundle_file(name: str) -> Path:
    path = bundle_dir() / name
    if not path.is_file():
        raise FileNotFoundError(f"bundled runtime file missing: {path}")
    return path


@cache
def manifest() -> dict[str, Any]:
    """Provenance of the bundle: source repository, commit, version and SHA-256 of each file."""
    data: dict[str, Any] = json.loads((bundle_dir() / "MANIFEST.json").read_text())
    return data


def check_node(settings: HojaSettings) -> str:
    """The Node.js executable to use. Raises a clear error when it is missing or too old."""
    from .session import HojaRuntimeError

    path = settings.node_path()
    if path is None:
        raise HojaRuntimeError(
            f"Node.js {MIN_NODE_MAJOR}+ is required to run the Hoja runtime, but '{settings.node}' was not found. "
            "Install Node.js, or set HOJA_NODE to its path."
        )
    major = _node_major(path)
    if major is not None and major < MIN_NODE_MAJOR:
        raise HojaRuntimeError(f"Node.js {MIN_NODE_MAJOR}+ is required; {path} is version {major}.")
    return path


@cache
def _node_major(path: str) -> int | None:
    try:
        out = subprocess.run([path, "--version"], check=False, capture_output=True, text=True, timeout=10).stdout
    except (OSError, subprocess.SubprocessError):
        return None
    match = re.match(r"v(\d+)", out.strip())
    return int(match.group(1)) if match else None
