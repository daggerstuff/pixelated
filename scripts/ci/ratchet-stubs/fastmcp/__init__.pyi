"""Minimal fastmcp surface for the isolated ratchet analysis.

Same isolation artefact as pytest: `from fastmcp import FastMCP` resolves to
Any, so the bare `@mcp.tool` decorator makes every tool function untyped and
the gate reports twelve errors that are about a missing stub, not about the
tools. Declaring `tool` in both its bare and called forms keeps the tool
signatures type-checked.
"""

from collections.abc import Callable
from typing import Any, overload

class FastMCP:
    def __init__(self, *args: Any, **kwargs: Any) -> None: ...
    @overload
    def tool[F: Callable[..., Any]](self, __func: F) -> F: ...
    @overload
    def tool[F: Callable[..., Any]](self, *args: Any, **kwargs: Any) -> Callable[[F], F]: ...
    def __getattr__(self, name: str) -> Any: ...

def __getattr__(name: str) -> Any: ...
