"""Typer CLI — main entry point for the corpus pipeline.

Usage:
    corpus plan YYYY-MM [--work-dir monthly_work]
    corpus plan-all [--work-dir monthly_work]
    corpus gate YYYY-MM [--work-dir monthly_work]
    corpus enrich YYYY-MM [--work-dir monthly_work]
    corpus generate YYYY-MM [--work-dir monthly_work] [--model MODEL] [--dry-run]
    corpus audit YYYY-MM [--work-dir monthly_work]
    corpus adversarial YYYY-MM [--work-dir monthly_work]
    corpus llm-review YYYY-MM [--work-dir monthly_work] [--model MODEL]
    corpus run-month YYYY-MM [--work-dir monthly_work]
    corpus status YYYY-MM [--work-dir monthly_work]
    corpus status-all [--work-dir monthly_work]
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Optional

import typer
from rich import print as rprint
from rich.console import Console
from rich.table import Table

app = typer.Typer(
    name="corpus",
    help="Pixelated Empathy synthetic corpus generator",
    add_completion=False,
)
console = Console()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

DEFAULT_WORK_DIR = Path("monthly_work")


def _work_dir_opt() -> Path:
    return DEFAULT_WORK_DIR


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------


@app.command()
def plan(
    month: str = typer.Argument(..., help="Month to plan, e.g. 2025-07"),
    work_dir: Path = typer.Option(DEFAULT_WORK_DIR, "--work-dir", help="Root work directory"),
    prior_summary: Optional[str] = typer.Option(None, "--prior-summary", help="Prior month summary text"),
) -> None:
    """Plan a single month: emit month_bible.json and salvage_candidates.json."""
    from pixelated_empathy.monthly_pipeline import plan_month
    month_dir = work_dir / month
    rprint(f"[bold blue]Planning {month}…[/bold blue]")
    bible, salvage = plan_month(month, month_dir, prior_summary)
    rprint(f"[green]✓[/green] {month}: {len(bible.events)} events, {len(salvage)} salvage candidates")
    rprint(f"  Written to {month_dir / 'month_bible.json'}")


@app.command(name="plan-all")
def plan_all(
    work_dir: Path = typer.Option(DEFAULT_WORK_DIR, "--work-dir"),
) -> None:
    """Plan all 12 months and write the manifest."""
    from pixelated_empathy.monthly_pipeline import build_manifest, plan_month
    from pixelated_empathy.schemas import MONTH_ORDER

    rprint("[bold blue]Planning all months…[/bold blue]")
    manifest = build_manifest(work_dir)
    rprint(f"[green]✓[/green] Manifest written ({len(manifest.months)} months)")

    for month in MONTH_ORDER:
        month_dir = work_dir / month
        try:
            bible, salvage = plan_month(month, month_dir)
            rprint(f"  [green]✓[/green] {month}: {len(bible.events)} events")
        except Exception as exc:
            rprint(f"  [red]✗[/red] {month}: {exc}")
            sys.exit(1)


@app.command()
def gate(
    month: str = typer.Argument(..., help="Month to check, e.g. 2025-07"),
    work_dir: Path = typer.Option(DEFAULT_WORK_DIR, "--work-dir"),
) -> None:
    """Check gate readiness for a month."""
    from pixelated_empathy.monthly_gate import prepare

    rprint(f"[bold blue]Checking gate for {month}…[/bold blue]")
    report = prepare(month, work_dir)

    table = Table(title=f"Gate Report: {month}")
    table.add_column("Check", style="cyan")
    table.add_column("Result", style="bold")
    table.add_column("Detail")

    for check in report.checks:
        result = "[green]PASS[/green]" if check["passed"] else "[red]FAIL[/red]"
        table.add_row(str(check["check"]), result, str(check.get("detail", "")))

    console.print(table)

    status_color = "green" if report.status == "ready" else "red"
    rprint(f"\nStatus: [{status_color}]{report.status.upper()}[/{status_color}]")

    if report.status != "ready":
        sys.exit(1)


@app.command()
def enrich(
    month: str = typer.Argument(..., help="Month to enrich"),
    work_dir: Path = typer.Option(DEFAULT_WORK_DIR, "--work-dir"),
) -> None:
    """Build month enrichment context packet."""
    from pixelated_empathy.monthly_enrichment import build

    rprint(f"[bold blue]Building enrichment for {month}…[/bold blue]")
    enrichment = build(month, work_dir)
    rprint(
        f"[green]✓[/green] {month}: "
        f"{len(enrichment.events)} events, "
        f"{len(enrichment.topic_names)} topics, "
        f"{len(enrichment.persona_contexts)} personas"
    )


@app.command()
def generate(
    month: str = typer.Argument(..., help="Month to generate"),
    work_dir: Path = typer.Option(DEFAULT_WORK_DIR, "--work-dir"),
    model: Optional[str] = typer.Option(None, "--model", help="Override Ollama model"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be generated without calling LLM"),
) -> None:
    """Run LLM generation for a month."""
    from pixelated_empathy.monthly_llm_jobs import launch

    rprint(f"[bold blue]{'[DRY RUN] ' if dry_run else ''}Generating {month}…[/bold blue]")
    report = launch(month, work_dir, model_override=model, dry_run=dry_run)
    rprint(
        f"[green]✓[/green] {month}: "
        f"{report.emails_generated} emails, "
        f"{report.chat_bursts_generated} chat bursts "
        f"({report.batches_failed} batches failed, "
        f"{report.parse_failures} parse failures, "
        f"{report.gate_rejections} gate rejections)"
    )


@app.command()
def audit(
    month: str = typer.Argument(..., help="Month to audit"),
    work_dir: Path = typer.Option(DEFAULT_WORK_DIR, "--work-dir"),
) -> None:
    """Run structural audit on a month."""
    from pixelated_empathy.monthly_auditor import audit as run_audit

    rprint(f"[bold blue]Auditing {month}…[/bold blue]")
    report = run_audit(month, work_dir)

    rprint(
        f"Emails: {report.email_count} | Chat bursts: {report.chat_burst_count} | "
        f"Critical: {report.critical_count} | Warnings: {report.warning_count}"
    )

    if report.findings:
        table = Table(title="Audit Findings")
        table.add_column("Severity")
        table.add_column("Category")
        table.add_column("Artifact ID")
        table.add_column("Detail")
        for f in report.findings[:50]:  # show max 50
            color = "red" if f.severity.value == "CRITICAL" else "yellow"
            table.add_row(
                f"[{color}]{f.severity.value}[/{color}]",
                f.category,
                f.artifact_id,
                f.detail[:80],
            )
        console.print(table)

    status_color = "green" if report.passed else "red"
    rprint(f"\nAudit: [{status_color}]{'PASSED' if report.passed else 'FAILED'}[/{status_color}]")
    if not report.passed:
        sys.exit(1)


@app.command()
def adversarial(
    month: str = typer.Argument(..., help="Month to review"),
    work_dir: Path = typer.Option(DEFAULT_WORK_DIR, "--work-dir"),
) -> None:
    """Run rule-based adversarial review on a month."""
    from pixelated_empathy.monthly_adversarial_review import review as run_review

    rprint(f"[bold blue]Adversarial review (rule-based) for {month}…[/bold blue]")
    report = run_review(month, work_dir)

    rprint(
        f"Artifacts reviewed: {report.artifacts_reviewed} | "
        f"Critical: {report.critical_count} | "
        f"Total findings: {len(report.findings)}"
    )

    if report.findings:
        table = Table(title="Adversarial Findings")
        table.add_column("Severity")
        table.add_column("Rule")
        table.add_column("Artifact ID")
        table.add_column("Excerpt")
        for f in report.findings[:50]:
            color = "red" if f.severity.value == "CRITICAL" else "yellow"
            table.add_row(
                f"[{color}]{f.severity.value}[/{color}]",
                f.rule,
                f.artifact_id,
                f.excerpt[:60],
            )
        console.print(table)

    status_color = "green" if report.passed else "red"
    rprint(f"\nAdversarial review: [{status_color}]{'PASSED' if report.passed else 'FAILED'}[/{status_color}]")
    if not report.passed:
        sys.exit(1)


@app.command(name="llm-review")
def llm_review(
    month: str = typer.Argument(..., help="Month to LLM-judge"),
    work_dir: Path = typer.Option(DEFAULT_WORK_DIR, "--work-dir"),
    model: Optional[str] = typer.Option(None, "--model", help="Override judge model"),
) -> None:
    """Run 3-persona LLM judge review on a month."""
    from pixelated_empathy.monthly_adversarial_llm_review import review as run_llm_review

    rprint(f"[bold blue]LLM judge review for {month}…[/bold blue]")
    report = run_llm_review(month, work_dir, model_override=model)

    table = Table(title="LLM Judge Results")
    table.add_column("Persona")
    table.add_column("Score")
    table.add_column("Result")
    table.add_column("Notes")

    for result in report.persona_results:
        color = "green" if result.passed else "red"
        table.add_row(
            result.persona,
            f"{result.score:.2f}",
            f"[{color}]{'PASS' if result.passed else 'FAIL'}[/{color}]",
            result.notes[:100],
        )
    console.print(table)

    status_color = "green" if report.passed else "red"
    rprint(f"\nLLM review: [{status_color}]{'PASSED' if report.passed else 'FAILED'}[/{status_color}]")
    if not report.passed:
        sys.exit(1)


@app.command(name="run-month")
def run_month(
    month: str = typer.Argument(..., help="Month to fully process"),
    work_dir: Path = typer.Option(DEFAULT_WORK_DIR, "--work-dir"),
    model: Optional[str] = typer.Option(None, "--model"),
    skip_llm_review: bool = typer.Option(False, "--skip-llm-review", help="Skip the 3-persona LLM judge"),
) -> None:
    """Full pipeline for one month: plan → gate → enrich → generate → audit → adversarial → llm-review.

    All three gates must pass before the month is marked ACCEPTED.
    """
    from pixelated_empathy.monthly_pipeline import plan_month
    from pixelated_empathy.monthly_gate import prepare, mark_accepted, mark_rejected
    from pixelated_empathy.monthly_enrichment import build
    from pixelated_empathy.monthly_llm_jobs import launch
    from pixelated_empathy.monthly_auditor import audit as run_audit
    from pixelated_empathy.monthly_adversarial_review import review as run_adv
    from pixelated_empathy.monthly_adversarial_llm_review import review as run_llm

    rprint(f"\n[bold cyan]━━━ Running full pipeline for {month} ━━━[/bold cyan]\n")

    # Step 1: Plan
    rprint("[bold]Step 1: Plan[/bold]")
    month_dir = work_dir / month
    plan_month(month, month_dir)
    rprint("[green]  ✓ Plan complete[/green]")

    # Step 2: Enrich
    rprint("[bold]Step 2: Enrich[/bold]")
    build(month, work_dir)
    rprint("[green]  ✓ Enrichment complete[/green]")

    # Step 3: Gate check
    rprint("[bold]Step 3: Gate check[/bold]")
    gate_report = prepare(month, work_dir)
    if gate_report.status != "ready":
        rprint(f"[red]  ✗ Gate not ready: {[c for c in gate_report.checks if not c['passed']]}[/red]")
        sys.exit(1)
    rprint("[green]  ✓ Gate ready[/green]")

    # Step 4: Generate
    rprint("[bold]Step 4: Generate[/bold]")
    gen_report = launch(month, work_dir, model_override=model)
    rprint(
        f"[green]  ✓ Generated {gen_report.emails_generated} emails, "
        f"{gen_report.chat_bursts_generated} chat bursts[/green]"
    )

    # Step 5: Structural audit
    rprint("[bold]Step 5: Structural audit[/bold]")
    audit_report = run_audit(month, work_dir)
    rprint(
        f"  Critical: {audit_report.critical_count}, Warnings: {audit_report.warning_count}"
    )
    if not audit_report.passed:
        mark_rejected(month, work_dir, f"Structural audit failed: {audit_report.critical_count} critical findings")
        rprint("[red]  ✗ Audit FAILED — remediate and re-run[/red]")
        sys.exit(1)
    rprint("[green]  ✓ Audit passed[/green]")

    # Step 6: Adversarial rule-based review
    rprint("[bold]Step 6: Adversarial rule-based review[/bold]")
    adv_report = run_adv(month, work_dir)
    rprint(f"  Critical: {adv_report.critical_count}, Total findings: {len(adv_report.findings)}")
    if not adv_report.passed:
        mark_rejected(month, work_dir, f"Adversarial review failed: {adv_report.critical_count} critical findings")
        rprint("[red]  ✗ Adversarial review FAILED — remediate and re-run[/red]")
        sys.exit(1)
    rprint("[green]  ✓ Adversarial review passed[/green]")

    # Step 7: LLM judge review
    if not skip_llm_review:
        rprint("[bold]Step 7: LLM judge review (3 personas)[/bold]")
        llm_report = run_llm(month, work_dir, model_override=model)
        for result in llm_report.persona_results:
            symbol = "✓" if result.passed else "✗"
            color = "green" if result.passed else "red"
            rprint(f"  [{color}]{symbol}[/{color}] {result.persona}: {result.score:.2f}")
        if not llm_report.passed:
            mark_rejected(month, work_dir, "LLM judge review failed")
            rprint("[red]  ✗ LLM review FAILED — remediate and re-run[/red]")
            sys.exit(1)
        rprint("[green]  ✓ LLM review passed[/green]")
    else:
        rprint("[dim]  ⊘ LLM review skipped[/dim]")

    # All passed — mark accepted
    mark_accepted(month, work_dir)
    rprint(f"\n[bold green]━━━ {month} ACCEPTED ━━━[/bold green]\n")


@app.command()
def status(
    month: str = typer.Argument(..., help="Month to check"),
    work_dir: Path = typer.Option(DEFAULT_WORK_DIR, "--work-dir"),
) -> None:
    """Show generation status for a month."""
    from pixelated_empathy.monthly_llm_jobs import status as get_status

    info = get_status(month, work_dir)
    rprint(f"\n[bold]Status: {month}[/bold]")
    rprint(f"  Emails: {info['email_count']} / {info['target_emails']}")
    rprint(f"  Chat bursts: {info['chat_burst_count']} / {info['target_chat_bursts']}")
    rprint(f"  Checkpoints: {info['checkpoints']}")
    rprint(f"  In progress: {'[yellow]yes[/yellow]' if info['in_progress'] else 'no'}")
    if info["report"]:
        r = info["report"]
        rprint(f"  Last run: {r.get('batches_run', 0)} batches, "
               f"{r.get('batches_failed', 0)} failed")


@app.command(name="status-all")
def status_all(
    work_dir: Path = typer.Option(DEFAULT_WORK_DIR, "--work-dir"),
) -> None:
    """Show status for all months."""
    from pixelated_empathy.monthly_llm_jobs import status as get_status
    from pixelated_empathy.monthly_gate import get_accepted_months
    from pixelated_empathy.schemas import MONTH_ORDER, MONTH_TARGETS

    accepted = set(get_accepted_months(work_dir))

    table = Table(title="Corpus Status — All Months")
    table.add_column("Month")
    table.add_column("Tier")
    table.add_column("Emails")
    table.add_column("Target")
    table.add_column("Chats")
    table.add_column("Target")
    table.add_column("Status")

    for month in MONTH_ORDER:
        info = get_status(month, work_dir)
        target = MONTH_TARGETS[month]
        tier = target["tier"].value
        if month in accepted:
            status_text = "[green]ACCEPTED[/green]"
        elif info["email_count"] > 0:
            status_text = "[yellow]IN PROGRESS[/yellow]"
        else:
            status_text = "[dim]NOT STARTED[/dim]"

        table.add_row(
            month,
            tier,
            str(info["email_count"]),
            str(info["target_emails"]),
            str(info["chat_burst_count"]),
            str(info["target_chat_bursts"]),
            status_text,
        )

    console.print(table)


if __name__ == "__main__":
    app()
