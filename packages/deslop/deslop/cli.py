from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

from deslop.engine import CleanOptions, apply_deslop_to_file, preview_file
from deslop.models import CleanReport, RegenReport, ScanReport, dump_json
from deslop.regen import OpenAICompatibleClient, regen_file, regen_file_with_ollama
from deslop.reports import write_report
from deslop.rules.core import DEFAULT_RULE_PACKS, load_rule_set
from deslop.scanner import ScanOptions, scan_file

app = typer.Typer(no_args_is_help=True, help="Deslop: dataset hygiene for AI-generated corpus cleanup.")
rules_app = typer.Typer(help="Inspect bundled rule packs.")
app.add_typer(rules_app, name="rules")
console = Console()

BANNER = r"""
 ██████╗ ███████╗██████╗ ██████╗ ███████╗██████╗
 ██╔══██╗██╔════╝██╔═══╝ ██╔══██╗██╔════╝██╔══██╗
 ██║  ██║█████╗  ██║     ██████╔╝█████╗  ██████╔╝
 ██║  ██║██╔══╝  ██║     ██╔═══╝ ██╔══╝  ██╔══██╗
 ██████╔╝███████╗╚██████╗██║     ███████╗██║  ██║
 ╚═════╝ ╚══════╝ ╚═════╝╚═╝     ╚══════╝╚═╝  ╚═╝
                   clean your data.
"""


def show_banner(json_output: bool) -> None:
    if not json_output:
        console.print(f"[dim]{BANNER}[/dim]\n")


def parse_csv(value: str | None) -> tuple[str, ...]:
    if value is None or not value.strip():
        return ()
    return tuple(item.strip() for item in value.split(",") if item.strip())


def build_rules(rules: Path | None, packs: str | None):
    return load_rule_set(rules, list(parse_csv(packs)))


def print_scan(report: ScanReport) -> None:
    density_style = "green" if report.slop_density_pct < 5 else "yellow" if report.slop_density_pct < 15 else "bold red"
    console.print(
        f"[bold]Deslop dataset quality receipt[/bold] [{density_style}]{report.slop_density_pct}%[/{density_style}]"
    )
    console.print(f"records: [cyan]{report.records_flagged}[/cyan] flagged / {report.records_scanned} scanned")
    table = Table(show_edge=False)
    table.add_column("pattern", style="cyan")
    table.add_column("hits", justify="right")
    for pattern, count in list(report.top_slop_patterns.items())[:20]:
        table.add_row(pattern, str(count))
    console.print(table)


def print_clean(report: CleanReport | RegenReport) -> None:
    console.print(dump_json(report.to_dict()))


@app.command()
def scan(
    input_file: Path,
    json_output: bool = typer.Option(False, "--json", help="Emit machine-readable JSON."),
    report: Path | None = typer.Option(None, "--report", help="Write .json, .md, or .html quality report."),
    rules: Path | None = typer.Option(None, "--rules", help="Custom rules.yaml."),
    packs: str | None = typer.Option(None, "--packs", help="Comma-separated bundled rule packs."),
    fields: str | None = typer.Option(None, "--fields", help="Comma-separated field path filters."),
    sample: int | None = typer.Option(None, "--sample", help="Scan only the first N records."),
    fail_on_density: float | None = typer.Option(None, "--fail-on-density", help="Exit non-zero above this density."),
) -> None:
    show_banner(json_output)
    active_rules = build_rules(rules, packs)
    scan_report = scan_file(input_file, ScanOptions(rules=active_rules, fields=parse_csv(fields), sample=sample))
    if report is not None:
        write_report(report, scan_report)
    if json_output:
        console.print(dump_json(scan_report.to_dict()))
    else:
        print_scan(scan_report)
    if fail_on_density is not None and scan_report.slop_density_pct > fail_on_density:
        raise typer.Exit(2)


@app.command()
def clean(
    input_file: Path,
    output: Path | None = typer.Option(None, "--output", "-o", help="Output JSONL file."),
    in_place: bool = typer.Option(False, "--in-place", help="Replace the input file."),
    backup: bool = typer.Option(False, "--backup", help="Write a .bak before in-place replacement."),
    rules: Path | None = typer.Option(None, "--rules", help="Custom rules.yaml."),
    packs: str | None = typer.Option(None, "--packs", help="Comma-separated bundled rule packs."),
    fields: str | None = typer.Option(None, "--fields", help="Comma-separated field path filters."),
    json_output: bool = typer.Option(False, "--json", help="Emit machine-readable JSON."),
) -> None:
    show_banner(json_output)
    if output is not None and in_place:
        raise typer.BadParameter("clean: --output and --in-place are mutually exclusive")
    if output is None and not in_place:
        raise typer.BadParameter("clean requires --output or --in-place")
    target = output or input_file.with_suffix(input_file.suffix + ".tmp")
    report = apply_deslop_to_file(
        input_file, target, CleanOptions(rules=build_rules(rules, packs), fields=parse_csv(fields))
    )
    if in_place:
        if backup:
            input_file.with_suffix(input_file.suffix + ".bak").write_text(
                input_file.read_text(encoding="utf-8"), encoding="utf-8"
            )
        target.replace(input_file)
    if json_output:
        console.print(dump_json(report.to_dict()))
    else:
        print_clean(report)


@app.command()
def preview(
    input_file: Path,
    limit: int = typer.Option(20, "--limit", min=1),
    rules: Path | None = typer.Option(None, "--rules"),
    packs: str | None = typer.Option(None, "--packs"),
    fields: str | None = typer.Option(None, "--fields"),
    json_output: bool = typer.Option(False, "--json"),
) -> None:
    show_banner(json_output)
    report = preview_file(input_file, CleanOptions(rules=build_rules(rules, packs), fields=parse_csv(fields)), limit)
    if json_output:
        console.print(dump_json(report.to_dict()))
        return
    for item in report.items:
        console.print(f"[cyan]{item.record_id}[/cyan] {item.field_path}")
        console.print(f"[red]- {item.before}[/red]")
        console.print(f"[green]+ {item.after}[/green]")


@app.command()
def diff(input_file: Path, limit: int = typer.Option(50, "--limit", min=1)) -> None:
    preview(input_file=input_file, limit=limit, rules=None, packs=None, fields=None, json_output=False)


@app.command()
def regen(
    input_file: Path,
    output: Path = typer.Option(..., "--output", "-o"),
    provider: str = typer.Option("ollama", "--provider", help="ollama or openai-compatible"),
    endpoint: str = typer.Option("http://127.0.0.1:11434", "--endpoint"),
    model: str = typer.Option("llama3.2", "--model"),
    api_key_env: str = typer.Option("OPENAI_API_KEY", "--api-key-env"),
    all_records: bool = typer.Option(False, "--all-records"),
    rules: Path | None = typer.Option(None, "--rules"),
    packs: str | None = typer.Option(None, "--packs"),
    json_output: bool = typer.Option(False, "--json"),
) -> None:
    show_banner(json_output)
    active_rules = build_rules(rules, packs)
    if provider == "ollama":
        report = regen_file_with_ollama(
            input_file,
            output,
            endpoint=endpoint,
            model=model,
            only_flagged=not all_records,
            rules=active_rules,
        )
    elif provider == "openai-compatible":
        report = regen_file(
            input_file,
            output,
            OpenAICompatibleClient(endpoint=endpoint, model=model, api_key_env=api_key_env),
            only_flagged=not all_records,
            rules=active_rules,
        )
    else:
        raise typer.BadParameter("provider must be ollama or openai-compatible")
    if json_output:
        console.print(dump_json(report.to_dict()))
    else:
        print_clean(report)


@rules_app.command("list")
def list_rules() -> None:
    show_banner(False)
    table = Table(show_edge=False)
    table.add_column("pack", style="cyan")
    table.add_column("markers")
    for name, markers in DEFAULT_RULE_PACKS.items():
        table.add_row(name, str(len(markers)))
    console.print(table)


@rules_app.command("explain")
def explain_rule_pack(name: str) -> None:
    show_banner(False)
    markers = DEFAULT_RULE_PACKS.get(name)
    if markers is None:
        raise typer.BadParameter(f"unknown rule pack: {name}")
    for marker in markers:
        console.print(f"- {marker}")


def main() -> None:
    app()


if __name__ == "__main__":
    main()
