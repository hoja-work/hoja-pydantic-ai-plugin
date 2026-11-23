"""The runtime's tools as a Pydantic AI toolset.

The tool list (names, descriptions, JSON schemas) comes from the runtime itself, so it always matches the bundled
version: ``TaskManage``, ``hoja_trace``, ``hoja_setup``, ``hoja_list``/``hoja_get``/``hoja_project`` while Hoja mode is
on, and the hosted Hoja API when it is enabled.
"""

from __future__ import annotations

from typing import Any

from pydantic_ai import Tool
from pydantic_ai.toolsets import FunctionToolset

from .runtime.session import HojaSession, ToolSpec


class ToolErrorText(str):
    """A tool result the runtime marked as an error (``isError``), such as a rejected TaskManage completion.

    It is returned rather than raised so the model reads the reason and corrects itself. Raising ``ModelRetry`` would
    count against the tool's retry budget and end the run after a couple of honest mistakes.
    """


def hoja_tool(session: HojaSession, spec: ToolSpec) -> Tool[Any]:
    """One runtime tool as a Pydantic AI :class:`~pydantic_ai.Tool`, schema and description verbatim."""

    async def call(**kwargs: Any) -> str:
        text, is_error = await session.call_tool(spec.name, kwargs)
        return ToolErrorText(text) if is_error else text

    call.__name__ = spec.name
    return Tool.from_schema(call, name=spec.name, description=spec.description, json_schema=spec.input_schema)


def hoja_toolset(session: HojaSession, *, hosted_api: bool | None = None, id: str = "hoja") -> FunctionToolset[Any]:
    """Every tool the session's runtime serves. Starts the runtime if it is not running yet.

    ``hosted_api=False`` leaves out the hosted Hoja API even when the runtime serves it.
    """
    specs = [s for s in session.tools() if hosted_api is not False or not s.hosted]
    return FunctionToolset([hoja_tool(session, s) for s in specs], id=id)
