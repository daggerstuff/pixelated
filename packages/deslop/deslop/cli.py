import argparse
import json
import sys
from pathlib import Path

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table
    from rich.text import Text

    console = Console()
except ImportError:
    console = None


def _print_report(report: dict, title: str):
    if not console:
        sys.stdout.write(json.dumps(report, indent=2) + "\n")
        return

    console.print(f"\n[bold cyan]🧼 {title}[/bold cyan]")

    if "slop_density_pct" in report:
        density = report["slop_density_pct"]
        color = "green" if density < 5 else "yellow" if density < 15 else "red"
        console.print(
            f"[bold {color}]Slop Density: {density}%[/bold {color}] (Flagged {report['records_flagged']} out of {report['records_scanned']} records)"
        )

        if report.get("top_slop_patterns"):
            table = Table(title="Top Slop Patterns Detected")
            table.add_column("Pattern", justify="left", style="cyan", no_wrap=True)
            table.add_column("Hits", justify="right", style="magenta")
            for pattern, count in report["top_slop_patterns"].items():
                table.add_row(pattern, str(count))
            console.print(table)
    else:
        processed = report.get("records_processed", 0)
        rewritten = report.get("records_rewritten", report.get("records_rewritten_via_llm", 0))
        failed = report.get("records_failed_regen", 0)
        console.print(f"[green]✔ Processed:[/green] {processed} records")
        console.print(f"[blue]✔ Rewritten:[/blue] {rewritten} records")
        if failed > 0:
            console.print(f"[red]✖ Failed LLM Regen:[/red] {failed} records")
    console.print("\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Deslop: AI Corpus Deslopping CLI")
    parser.add_argument("input_file", type=Path, help="Path to the input JSON/JSONL dataset")
    parser.add_argument("--mode", choices=["scan", "clean", "ollama"], default="scan", help="Action to perform")
    parser.add_argument("--output", type=Path, help="Path to save the cleaned dataset")
    parser.add_argument("--in-place", action="store_true", help="Modify the input file in place")
    parser.add_argument("--endpoint", type=str, default="http://127.0.0.1:11434", help="Ollama API endpoint")
    parser.add_argument("--model", type=str, default="llama3.2", help="Ollama model to use for regen")
    parser.add_argument("--rules", type=Path, help="Path to custom rules.yaml file")

    args = parser.parse_args()
    input_file: Path = args.input_file

    if not input_file.is_file():
        if console:
            console.print(f"[bold red]Error:[/bold red] File not found: {input_file}")
        else:
            sys.stdout.write(f"Error: File not found: {input_file}\n")
        sys.exit(1)

    if args.mode in ["clean", "ollama"] and not args.output and not args.in_place:
        if console:
            console.print(f"[bold red]Error:[/bold red] Must specify --output or --in-place for {args.mode} mode")
        else:
            sys.stdout.write(f"Error: Must specify --output or --in-place for {args.mode} mode\n")
        sys.exit(1)

    if args.rules:
        from deslop.rules.core import load_custom_rules

        try:
            load_custom_rules(args.rules)
        except Exception as exc:
            if console:
                console.print(f"[bold red]Error loading rules:[/bold red] {exc}")
            sys.exit(1)

    try:
        if args.mode == "scan":
            from deslop.scanner import scan_file

            report = scan_file(input_file)
            _print_report(report, "Slop Remediation Report")

        elif args.mode == "clean":
            from deslop.engine import apply_deslop_to_file

            out_path = args.output if args.output else input_file.with_suffix(".tmp")
            report = apply_deslop_to_file(input_file, out_path)

            if args.in_place and not args.output:
                out_path.replace(input_file)

            _print_report(report, "Deslop Clean Complete")

        elif args.mode == "ollama":
            from deslop.regen import regen_file_with_ollama

            out_path = args.output if args.output else input_file.with_suffix(".tmp")

            if console:
                console.print(f"[cyan]Connecting to Ollama at {args.endpoint}...[/cyan]")

            report = regen_file_with_ollama(input_file, out_path, endpoint=args.endpoint, model=args.model)

            if args.in_place and not args.output:
                out_path.replace(input_file)

            _print_report(report, "LLM Regen Complete")

    except Exception as exc:
        if console:
            console.print(f"[bold red]Fatal Error:[/bold red] {exc}")
        else:
            sys.stdout.write(f"Error: {exc}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
