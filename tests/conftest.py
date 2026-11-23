"""Shared fixtures. No test reaches a model provider or a Hoja workspace."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

import pytest
from pydantic_ai import models

from pydantic_ai_hoja import HojaSettings

models.ALLOW_MODEL_REQUESTS = False
os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")

requires_node = pytest.mark.skipif(shutil.which("node") is None, reason="Node.js 22+ is not installed")


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    ws = tmp_path / "workspace"
    ws.mkdir()
    (ws / "README.md").write_text("# Demo\n\n## Install\n\nRun it.\n")
    return ws


@pytest.fixture
def settings(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> HojaSettings:
    """Local-only settings: no credentials, no Hoja CLI sign-in, no hosted API, an isolated data directory."""
    for name in list(os.environ):
        if name.startswith(("HOJA_", "LINEAR_")):
            monkeypatch.delenv(name)
    monkeypatch.setenv(
        "PATH", os.pathsep.join(p for p in os.environ["PATH"].split(os.pathsep) if not (Path(p) / "hoja").exists())
    )
    return HojaSettings.from_env(data_dir=tmp_path / "data", hoja_mode=False, hosted_api=False)
