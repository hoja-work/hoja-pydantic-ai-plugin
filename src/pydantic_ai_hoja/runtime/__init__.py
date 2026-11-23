"""The host-agnostic layer every Python Hoja plugin shares: settings, the runtime process, names and the transcript.

Host adapters (the :class:`~pydantic_ai_hoja.Hoja` capability, the Code Puppy plugin) translate their own lifecycle
into :class:`HojaSession` calls and act on the decisions it returns.
"""

from .names import API_PREFIX, DEFAULT_ALIASES, OWN_PREFIX, ToolNames
from .session import (
    COMMANDS,
    HojaRuntimeError,
    HojaSession,
    PromptDecision,
    StopDecision,
    ToolDecision,
    ToolSpec,
)
from .settings import HojaSettings
from .transcript import Usage

__all__ = [
    "API_PREFIX",
    "COMMANDS",
    "DEFAULT_ALIASES",
    "OWN_PREFIX",
    "HojaRuntimeError",
    "HojaSession",
    "HojaSettings",
    "PromptDecision",
    "StopDecision",
    "ToolDecision",
    "ToolNames",
    "ToolSpec",
    "Usage",
]
