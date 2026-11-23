"""Hoja for Pydantic AI: tasks that can't be marked done without proof.

Quick start::

    from pydantic_ai import Agent
    from pydantic_ai_hoja import Hoja

    agent = Agent("anthropic:claude-sonnet-4-5", capabilities=[Hoja()])
"""

from ._version import __version__
from .capability import Hoja
from .runtime import HojaRuntimeError, HojaSession, HojaSettings
from .toolset import ToolErrorText, hoja_tool, hoja_toolset

__all__ = [
    "Hoja",
    "HojaRuntimeError",
    "HojaSession",
    "HojaSettings",
    "ToolErrorText",
    "__version__",
    "hoja_tool",
    "hoja_toolset",
]
