"""Foresight CLI — memory, context-blocks, curation, system, and TUI.

Usage:
  foresight [--agent|--json] <command> [options]
  foresight tui                # Launch interactive TUI
  foresight store <content>    # Quick memory store
  foresight status             # System health
  foresight --help             # Full help
"""

from __future__ import annotations

import contextlib
from enum import StrEnum
from pathlib import Path

from dotenv import load_dotenv

_project_root = Path(__file__).resolve().parent.parent.parent
for _candidate in [Path(".env"), _project_root / ".env", Path.home() / ".env"]:
    if _candidate.exists():
        load_dotenv(_candidate)
        break

import typer

from .commands import analysis, blocks, curate, eval as eval_cmd, memory, system
from .utils import config as cfg, output as out


class OutputMode(StrEnum):
    human = "human"
    agent = "agent"
    json = "json"


_DEFAULT_OUTPUT = OutputMode.human


app = typer.Typer(
    name="foresight",
    help="Foresight Memory Management — CLI, TUI, and agent tools.",
    add_completion=True,
    rich_markup_mode="rich",
    pretty_exceptions_enable=False,
    no_args_is_help=True,
)

# Register command groups
app.add_typer(memory.app, name="memory", help="Store, retrieve, search memories.")
app.add_typer(analysis.app, name="analysis", help="Synthesize, reflect, profile, diff, rollback.")
app.add_typer(blocks.app, name="blocks", help="Manage context blocks.")
app.add_typer(curate.app, name="curate", help="Manage curation runs.")
app.add_typer(eval_cmd.app, name="eval", help="Run evaluation harness (PIX-3953).")
app.add_typer(system.app, name="system", help="System status, init, doctor, config, stats, history.")

# Top-level shorthand aliases (most common operations)
app.command(name="store", rich_help_panel="Quick Commands")(memory.store)
app.command(name="get", rich_help_panel="Quick Commands")(memory.get)
app.command(name="list", rich_help_panel="Quick Commands")(memory.list_memories)
app.command(name="query", rich_help_panel="Quick Commands")(memory.query)
app.command(name="delete", rich_help_panel="Quick Commands")(memory.delete)
app.command(name="reinforce", rich_help_panel="Quick Commands")(memory.reinforce)
app.command(name="search", rich_help_panel="Quick Commands")(memory.search)
app.command(name="export", rich_help_panel="Quick Commands")(memory.export)
app.command(name="import", rich_help_panel="Quick Commands")(memory.import_memories)
app.command(name="status", rich_help_panel="Quick Commands")(system.status)
app.command(name="init", rich_help_panel="Quick Commands")(system.init)
app.command(name="doctor", rich_help_panel="Quick Commands")(system.doctor)
app.command(name="stats", rich_help_panel="Quick Commands")(system.stats)
app.command(name="config", rich_help_panel="Quick Commands")(system.config)
app.command(name="synthesize", rich_help_panel="Quick Commands")(analysis.synthesize)
app.command(name="reflect", rich_help_panel="Quick Commands")(analysis.reflect)
app.command(name="profile", rich_help_panel="Quick Commands")(analysis.profile)


@app.callback()
def callback(  # noqa: PLR0913
    ctx: typer.Context,
    output: OutputMode | None = typer.Option(  # noqa: B008
        None,
        "--output",
        "-o",
        help="Output mode: human (rich), agent (tagged), json (raw JSON)",
        case_sensitive=False,
    ),
    agent: bool = typer.Option(False, "--agent", "-a", hidden=True),
    json_mode: bool = typer.Option(False, "--json", "-j", hidden=True),
    user_id: str | None = typer.Option(None, "--user-id", "-u", help="User ID override", hidden=True),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
):
    if agent:
        output = OutputMode.agent
    elif json_mode:
        output = OutputMode.json
    elif output is None:
        output = _DEFAULT_OUTPUT
    """Foresight Memory Management CLI — TUI, agent tools, and memory operations.

    [bold]Quick start:[/bold]
    \n
      foresight init          # First-time setup
      foresight status        # Check health
      foresight store 'hello world' --scope session
      foresight list
      foresight tui           # Launch the TUI
    \n
    [bold]Output modes:[/bold]
    \n
      -o human   Rich output with colors and tables (default)
      -o agent   Machine-parseable tagged lines, no ANSI, pipe-safe
      -o json    Pure JSON output
    """
    agent = output == OutputMode.agent
    json_mode = output == OutputMode.json
    out.configure(
        mode=output.value,
        color=True,
        pipe_safe=agent or json_mode,
        verbose=verbose,
    )

    # Initialize config
    ctx.obj = {
        "user_id": cfg.get_user_id(user_id),
        "agent": agent,
        "json": json_mode,
    }


def _decode_tool_result(result: str | dict) -> dict:
    """Wrap plain-text errors into JSON format for CLI JSON output mode.

    Args:
        result: Either a plain text error string or an already-parsed dict.

    Returns:
        A dict with ``{"ok": True, ...}`` for raw dict passthrough,
        or ``{"ok": False, "error": {"message": text}}`` for plain text.
    """
    if isinstance(result, dict):
        return result
    return {"ok": False, "error": {"message": result}}


try:
    from .tui.app import ForesightTUI
except ImportError:
    ForesightTUI = None

_tui_err = (
    "Cannot launch TUI — missing dependency: {e}\n"
    "Install with: pip install 'foresight-mcp[tui]' or: uv pip install 'foresight-mcp[tui]'"
)


@app.command()
def tui(
    user_id: str | None = typer.Option(None, "--user-id", "-u", help="User ID override", hidden=True),
):
    """Launch the Foresight interactive TUI (Textual)."""
    if ForesightTUI is None:
        out.error("Cannot launch TUI — missing dependency. Install with: pip install 'foresight-mcp[tui]'")
        raise typer.Exit(1)

    ui_cfg = cfg.ensure_config()
    resolved_uid = cfg.get_user_id(user_id)
    tui_app = ForesightTUI(user_id=resolved_uid, config=ui_cfg)
    with contextlib.suppress(KeyboardInterrupt):
        tui_app.run()


# Legacy entry point compatibility
main = app


if __name__ == "__main__":
    app()
