#!/usr/bin/env python3
"""
CI Operations Dashboard

Tracks and reports key CI/CD operational metrics across providers:
  1. Duplicate job count (jobs running redundantly across GH Actions + Bitbucket)
  2. PR feedback time (time from PR creation to CI check completion)
  3. Failed checks by lane (failures grouped by lane/type)
  4. Deploy gate failures (deploy stage failures including security gates)

Outputs:
  - Rich terminal report (stdout)
  - JSON snapshot (optional --output)
  - HTML dashboard (optional --html)
"""

from __future__ import annotations

import argparse
import datetime
import json
import logging
import os
import re
import subprocess
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import httpx
import yaml

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------


@dataclass
class WorkflowJob:
    """A single CI job definition parsed from a workflow file."""

    name: str
    workflow_name: str
    provider: str  # "github" | "bitbucket"
    lane: str  # "lint", "typecheck", "test", "build", "security", "deploy", "other"
    steps: list[str] = field(default_factory=list)


@dataclass
class WorkflowRun:
    """A single workflow run fetched from the GitHub Actions API."""

    name: str
    status: str
    conclusion: str | None
    url: str
    started_at: str | None
    completed_at: str | None
    event: str
    head_branch: str
    head_sha: str
    run_number: int


@dataclass
class DashboardReport:
    """Full dashboard report payload."""

    generated_at: str
    repo: str
    branch: str
    commit: str
    metrics: dict[str, Any]
    duplicate_jobs: list[dict[str, Any]]
    lane_failures: dict[str, list[dict[str, Any]]]
    deploy_gate_events: list[dict[str, Any]]
    provider_workflow_counts: dict[str, int]
    recent_runs: list[dict[str, Any]]


# ---------------------------------------------------------------------------
# Lane classification
# ---------------------------------------------------------------------------

LANE_PATTERNS: dict[str, list[str]] = {
    "lint": ["lint", "oxlint", "eslint", "ruff", "format"],
    "typecheck": ["typecheck", "type-check", "tsc", "typescript", "type check"],
    "test": ["test", "vitest", "pytest", "unit test", "advisory", "browser", "playwright"],
    "build": ["build", "docker", "image", "compile"],
    "security": ["security", "codeql", "trivy", "scan", "snyk", "sonar", "shellcheck"],
    "deploy": ["deploy", "release", "rollout", "civo", "k8s", "kubernetes"],
}


def classify_lane(job_name: str, workflow_name: str, steps: list[str] | None = None) -> str:
    """Classify a job into a lane based on its name, workflow name, and steps."""
    combined = f"{workflow_name.lower()} {job_name.lower()}"
    if steps:
        combined += " " + " ".join(s.lower() for s in steps)

    for lane, patterns in LANE_PATTERNS.items():
        for pat in patterns:
            if pat in combined:
                return lane
    return "other"


# ---------------------------------------------------------------------------
# Workflow file parser
# ---------------------------------------------------------------------------


def find_workflow_files(root: str = ".") -> list[Path]:
    """Find all CI workflow definition files (GitHub Actions + Bitbucket)."""
    result: list[Path] = []

    # GitHub Actions workflows
    gh_dir = Path(root) / ".github" / "workflows"
    if gh_dir.exists():
        for f in sorted(gh_dir.iterdir()):
            if f.suffix in (".yml", ".yaml") and f.is_file():
                result.append(f)

    # Bitbucket Pipelines
    bb_files = [Path(root) / "bitbucket-pipelines.yml", Path(root) / "bitbucket-pipelines.yaml"]
    for bb in bb_files:
        if bb.exists():
            result.append(bb)

    return result


def parse_workflow_yaml(path: Path, root: str = ".") -> list[WorkflowJob]:
    """Parse a workflow YAML file and extract job definitions."""
    try:
        with open(path) as f:
            data = yaml.safe_load(f)
    except (yaml.YAMLError, OSError) as exc:
        logger.warning("  ⚠ Could not parse %s: %s", path.name, exc)
        return []

    if not isinstance(data, dict):
        return []

    provider = "bitbucket" if "bitbucket" in path.name.lower() else "github"
    workflow_name = data.get("name", "") or data.get("pipeline", "") or path.stem

    jobs: list[WorkflowJob] = []

    if provider == "github":
        # GitHub Actions: top-level `jobs:` key
        gh_jobs = data.get("jobs", {})
        if isinstance(gh_jobs, dict):
            for jname, jbody in gh_jobs.items():
                if isinstance(jbody, dict):
                    steps_list: list[str] = []
                    for step in jbody.get("steps", []):
                        if isinstance(step, dict) and "name" in step:
                            steps_list.append(step["name"])
                        elif isinstance(step, dict) and "run" in step:
                            steps_list.append(step["run"][:80])
                    lane = classify_lane(jname, workflow_name, steps_list)
                    jobs.append(
                        WorkflowJob(
                            name=jname,
                            workflow_name=str(workflow_name),
                            provider=provider,
                            lane=lane,
                            steps=steps_list,
                        )
                    )
    else:
        # Bitbucket Pipelines: `pipelines:` key
        # Structure: pipelines.{event_type}[].{step|parallel}[]
        # Keys are 'step' (singular) for single steps or 'parallel' for parallel groups
        pipelines = data.get("pipelines", {})
        if isinstance(pipelines, dict):
            for event_type, steps_or_branches in pipelines.items():
                if isinstance(steps_or_branches, list):
                    for entry in steps_or_branches:
                        if not isinstance(entry, dict):
                            continue
                        # Single step: entry = {"step": <resolved_anchor_dict>}
                        if "step" in entry and isinstance(entry["step"], dict):
                            parsed = _parse_bb_step(entry["step"], event_type, provider)
                            if parsed:
                                jobs.append(parsed)
                        # Parallel group: entry = {"parallel": [{"step": ...}, ...]}
                        if "parallel" in entry and isinstance(entry["parallel"], list):
                            for parallel_entry in entry["parallel"]:
                                if isinstance(parallel_entry, dict) and "step" in parallel_entry:
                                    if isinstance(parallel_entry["step"], dict):
                                        parsed = _parse_bb_step(parallel_entry["step"], event_type, provider)
                                        if parsed:
                                            jobs.append(parsed)

    return jobs


def _parse_bb_step(step: dict, event_type: str, provider: str) -> WorkflowJob | None:
    sname = step.get("name", "")
    if not sname:
        script = step.get("script", [])
        if isinstance(script, list) and script:
            sname = str(script[0])[:60]
        else:
            sname = "unnamed"

    step_scripts: list[str] = []
    for s in step.get("script", []):
        if isinstance(s, str):
            step_scripts.append(s[:80])

    lane = classify_lane(sname, f"bitbucket/{event_type}", step_scripts)
    return WorkflowJob(
        name=str(sname)[:50],
        workflow_name=f"bitbucket/{event_type}",
        provider=provider,
        lane=lane,
        steps=step_scripts,
    )


def build_job_inventory(root: str = ".") -> tuple[list[WorkflowJob], dict[str, int]]:
    """Build a complete inventory of all CI jobs across providers."""
    all_jobs: list[WorkflowJob] = []
    for wf_path in find_workflow_files(root):
        all_jobs.extend(parse_workflow_yaml(wf_path, root))

    provider_counts: dict[str, int] = defaultdict(int)
    for j in all_jobs:
        provider_counts[j.provider] += 1

    return all_jobs, dict(provider_counts)


# ---------------------------------------------------------------------------
# Duplicate job detection
# ---------------------------------------------------------------------------


def find_duplicate_jobs(jobs: list[WorkflowJob]) -> list[dict[str, Any]]:
    """Find jobs that appear to run the same checks across multiple providers."""
    # Group jobs by lane name across providers
    lane_providers: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    for job in jobs:
        lane_providers[job.lane][job.provider].append(job.name)

    duplicates: list[dict[str, Any]] = []
    for lane, provs in sorted(lane_providers.items()):
        providers_present = list(provs.keys())
        if len(providers_present) >= 2:
            duplicates.append(
                {
                    "lane": lane,
                    "providers": providers_present,
                    "github_jobs": provs.get("github", []),
                    "bitbucket_jobs": provs.get("bitbucket", []),
                    "total_jobs": sum(len(v) for v in provs.values()),
                }
            )
    return duplicates


# ---------------------------------------------------------------------------
# GitHub Actions API collector
# ---------------------------------------------------------------------------


class GitHubActionsCollector:
    """Collect workflow run data from the GitHub Actions API."""

    API_BASE = "https://api.github.com"

    def __init__(self, token: str | None = None, repo: str | None = None) -> None:
        self.token = token or os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
        self.repo = repo or self._detect_repo()
        self._client = httpx.Client(
            base_url=self.API_BASE,
            headers=self._headers(),
            timeout=30.0,
        )

    def _headers(self) -> dict[str, str]:
        h: dict[str, str] = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "pixelated-ci-ops-dashboard/1.0",
        }
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    @staticmethod
    def _detect_repo() -> str | None:
        try:
            remote = subprocess.check_output(
                ["git", "remote", "get-url", "origin"], stderr=subprocess.DEVNULL, text=True
            ).strip()
            match = re.search(r"github\.com[:/]([^/]+/[^/]+?)(?:\.git)?$", remote)
            if match:
                return match.group(1)
        except Exception:
            pass
        return None

    def is_available(self) -> bool:
        """Check if the collector has enough info to query."""
        if not self.token:
            logger.info("  ⚠ GITHUB_TOKEN not set — GitHub API queries disabled")
            return False
        if not self.repo:
            logger.info("  ⚠ Could not detect GitHub repo — GitHub API queries disabled")
            return False
        return True

    def fetch_recent_runs(self, branch: str | None = None, days: int = 7) -> list[WorkflowRun]:
        """Fetch recent workflow runs from the GitHub Actions API."""
        if not self.is_available():
            return []

        url = f"/repos/{self.repo}/actions/runs"
        params: dict[str, str | int] = {"per_page": 100}

        if branch:
            params["branch"] = branch

        since = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)
        params["created"] = f">={since.strftime('%Y-%m-%dT%H:%M:%SZ')}"

        try:
            logger.info("  ▌ Fetching GitHub Actions runs (%d-day window)...", days)
            resp = self._client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPStatusError as exc:
            logger.warning("  ⚠ GitHub API error: %s %s", exc.response.status_code, exc.response.text[:200])
            return []
        except httpx.RequestError as exc:
            logger.warning("  ⚠ GitHub API request failed: %s", exc)
            return []

        runs: list[WorkflowRun] = []
        for run in data.get("workflow_runs", []):
            runs.append(
                WorkflowRun(
                    name=run.get("name", "unknown"),
                    status=run.get("status", "unknown"),
                    conclusion=run.get("conclusion"),
                    url=run.get("html_url", ""),
                    started_at=run.get("run_started_at"),
                    completed_at=run.get("updated_at"),
                    event=run.get("event", "unknown"),
                    head_branch=run.get("head_branch", ""),
                    head_sha=run.get("head_sha", ""),
                    run_number=run.get("run_number", 0),
                )
            )
        return runs


# ---------------------------------------------------------------------------
# Metrics computation
# ---------------------------------------------------------------------------


def compute_pr_feedback_time(runs: list[WorkflowRun]) -> dict[str, Any]:
    """Compute PR feedback time metrics from workflow runs."""
    pr_runs = [r for r in runs if r.event == "pull_request" and r.completed_at and r.started_at]

    if not pr_runs:
        return {"count": 0, "avg_minutes": None, "min_minutes": None, "max_minutes": None, "by_workflow": {}}

    durations: list[float] = []
    by_workflow: dict[str, list[float]] = defaultdict(list)

    for run in pr_runs:
        try:
            started = datetime.datetime.fromisoformat(run.started_at.replace("Z", "+00:00"))
            completed = datetime.datetime.fromisoformat(run.completed_at.replace("Z", "+00:00"))
            minutes = (completed - started).total_seconds() / 60.0
            durations.append(minutes)
            by_workflow[run.name].append(minutes)
        except (ValueError, AttributeError):
            continue

    if not durations:
        return {"count": 0, "avg_minutes": None, "min_minutes": None, "max_minutes": None, "by_workflow": {}}

    return {
        "count": len(durations),
        "avg_minutes": round(sum(durations) / len(durations), 1),
        "min_minutes": round(min(durations), 1),
        "max_minutes": round(max(durations), 1),
        "by_workflow": {
            wf: {
                "count": len(v),
                "avg_minutes": round(sum(v) / len(v), 1) if v else None,
                "min_minutes": round(min(v), 1) if v else None,
                "max_minutes": round(max(v), 1) if v else None,
            }
            for wf, v in sorted(by_workflow.items())
        },
    }


def compute_failed_checks_by_lane(runs: list[WorkflowRun], jobs: list[WorkflowJob]) -> dict[str, Any]:
    """Group failed checks by lane/type."""
    failed_runs = [r for r in runs if r.conclusion == "failure"]

    if not failed_runs:
        return {"total_failures": 0, "by_lane": {}, "by_workflow": {}}

    # Map workflow names to lanes using the job inventory
    name_to_lane: dict[str, str] = {}
    for job in jobs:
        name_to_lane[job.workflow_name] = job.lane

    by_lane: dict[str, int] = defaultdict(int)
    by_workflow: dict[str, int] = defaultdict(int)

    for run in failed_runs:
        by_workflow[run.name] += 1
        lane = name_to_lane.get(run.name, classify_lane(run.name, run.name))
        by_lane[lane] += 1

    return {
        "total_failures": len(failed_runs),
        "rate_pct": round(len(failed_runs) / len(runs) * 100, 1) if runs else 0,
        "by_lane": dict(sorted(by_lane.items(), key=lambda x: -x[1])),
        "by_workflow": dict(sorted(by_workflow.items(), key=lambda x: -x[1])),
    }


def compute_deploy_gate_failures(runs: list[WorkflowRun], jobs: list[WorkflowJob]) -> list[dict[str, Any]]:
    """Identify deploy gate failures from workflow runs."""
    deploy_workflows = {
        job.workflow_name for job in jobs if job.lane in ("deploy", "security") or "deploy" in job.workflow_name.lower()
    }

    gate_failures: list[dict[str, Any]] = []
    for run in runs:
        if run.name in deploy_workflows and run.conclusion == "failure":
            gate_failures.append(
                {
                    "workflow": run.name,
                    "run_number": run.run_number,
                    "branch": run.head_branch,
                    "conclusion": run.conclusion,
                    "url": run.url,
                    "completed_at": run.completed_at,
                }
            )

    return sorted(gate_failures, key=lambda x: x.get("completed_at", ""), reverse=True)


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------


def generate_html_report(report: DashboardReport) -> str:
    """Generate a self-contained HTML dashboard page."""
    m = report.metrics
    dj = report.duplicate_jobs
    lf = report.lane_failures

    # Color helpers
    def severity_color(val: float, good: float, warn: float) -> str:
        if val >= good:
            return "#2ecc71"
        if val >= warn:
            return "#f39c12"
        return "#e74c3c"

    dup_jobs_rows = ""
    for d in dj:
        dup_jobs_rows += f"""
        <tr>
            <td>{d["lane"]}</td>
            <td>{", ".join(d["providers"])}</td>
            <td>{d["total_jobs"]}</td>
            <td><code>{"; ".join(d.get("github_jobs", []))}</code></td>
        </tr>"""

    lane_rows = ""
    for lane, count in sorted(lf.get("by_lane", {}).items(), key=lambda x: -x[1]):
        lane_rows += f"""
        <tr>
            <td>{lane}</td>
            <td style="color:{severity_color(count, 0, 3)}">{count}</td>
        </tr>"""

    pr = m.get("pr_feedback_time", {})
    fc = m.get("failed_checks", {})

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CI Operations Dashboard — {report.repo}</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f1923; color: #e0e0e0; padding: 32px; }}
  h1 {{ font-size: 24px; margin-bottom: 4px; }}
  h2 {{ font-size: 18px; margin: 24px 0 12px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; }}
  .meta {{ color: #8b949e; font-size: 13px; margin-bottom: 24px; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }}
  .card {{ background: #1a2633; border-radius: 8px; padding: 20px; border: 1px solid #30363d; }}
  .card .value {{ font-size: 32px; font-weight: 700; margin-bottom: 4px; }}
  .card .label {{ font-size: 12px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; }}
  table {{ width: 100%; border-collapse: collapse; margin-bottom: 24px; }}
  th, td {{ text-align: left; padding: 8px 12px; border-bottom: 1px solid #30363d; font-size: 14px; }}
  th {{ color: #8b949e; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }}
  tr:hover td {{ background: #1c2a3a; }}
  code {{ background: #0f1923; padding: 2px 6px; border-radius: 3px; font-size: 12px; }}
  a {{ color: #58a6ff; text-decoration: none; }}
  a:hover {{ text-decoration: underline; }}
  .good {{ color: #2ecc71; }}
  .warn {{ color: #f39c12; }}
  .bad {{ color: #e74c3c; }}
  .footer {{ margin-top: 32px; font-size: 11px; color: #484f58; text-align: center; }}
</style>
</head>
<body>
<h1>🔍 CI Operations Dashboard</h1>
<p class="meta">{report.repo} · {report.branch}@{report.commit[:7]} · generated {report.generated_at}</p>

<div class="grid">
  <div class="card">
    <div class="value" style="color:{severity_color(len(dj), 0, 2)}">{len(dj)}</div>
    <div class="label">Duplicate Lanes (cross-provider)</div>
  </div>
  <div class="card">
    <div class="value">{pr.get("avg_minutes", "N/A")}{"m" if pr.get("avg_minutes") else ""}</div>
    <div class="label">Avg PR Feedback Time</div>
  </div>
  <div class="card">
    <div class="value" style="color:{severity_color(fc.get("total_failures", 0), 0, 5)}">{fc.get("total_failures", 0)}</div>
    <div class="label">Failed Checks ({fc.get("rate_pct", 0)}%)</div>
  </div>
  <div class="card">
    <div class="value" style="color:{severity_color(len(report.deploy_gate_events), 0, 2)}">{len(report.deploy_gate_events)}</div>
    <div class="label">Deploy Gate Failures</div>
  </div>
  <div class="card">
    <div class="value">{report.provider_workflow_counts.get("github", 0) + report.provider_workflow_counts.get("bitbucket", 0)}</div>
    <div class="label">Total Jobs (GH: {report.provider_workflow_counts.get("github", 0)} · BB: {report.provider_workflow_counts.get("bitbucket", 0)})</div>
  </div>
  <div class="card">
    <div class="value">{m.get("total_runs", 0)}</div>
    <div class="label">Recent Runs (7d)</div>
  </div>
</div>

<h2>📋 Duplicate Jobs (Cross-Provider)</h2>
<table>
<thead><tr><th>Lane</th><th>Providers</th><th>Jobs</th><th>GitHub Jobs</th></tr></thead>
<tbody>
  {dup_jobs_rows if dup_jobs_rows else '<tr><td colspan="4">No duplicates detected</td></tr>'}
</tbody>
</table>

<h2>❌ Failed Checks by Lane</h2>
<table>
<thead><tr><th>Lane</th><th>Failures</th></tr></thead>
<tbody>
  {lane_rows if lane_rows else '<tr><td colspan="2">No failures in the period</td></tr>'}
</tbody>
</table>

<h2>🛑 Deploy Gate Failures</h2>
<table>
<thead><tr><th>Workflow</th><th>Run #</th><th>Branch</th><th>Link</th></tr></thead>
<tbody>
  {"".join(f'<tr><td>{g["workflow"]}</td><td>{g["run_number"]}</td><td>{g["branch"]}</td><td><a href="{g["url"]}">view</a></td></tr>' for g in report.deploy_gate_events) if report.deploy_gate_events else '<tr><td colspan="4">No deploy gate failures in the period</td></tr>'}
</tbody>
</table>

<h2>⏱ PR Feedback Time</h2>
<table>
<thead><tr><th>Workflow</th><th>Runs</th><th>Avg</th><th>Min</th><th>Max</th></tr></thead>
<tbody>
  {"".join(f"<tr><td>{wf}</td><td>{v['count']}</td><td>{v['avg_minutes']}m</td><td>{v['min_minutes']}m</td><td>{v['max_minutes']}m</td></tr>" for wf, v in pr.get("by_workflow", {}).items()) if pr.get("by_workflow") else '<tr><td colspan="5">No PR feedback data available</td></tr>'}
</tbody>
</table>

<div class="footer">CI Ops Dashboard · Generated by pixelated-ci-ops-dashboard v1.0</div>
</body>
</html>"""


def print_terminal_report(report: DashboardReport) -> None:
    """Print a formatted terminal report using logging."""
    m = report.metrics

    logger.info("")
    logger.info("╔══════════════════════════════════════════════════════════╗")
    logger.info("║           CI OPERATIONS DASHBOARD                       ║")
    logger.info("╠══════════════════════════════════════════════════════════╣")
    logger.info("║  Repo:      %-38s ║", report.repo)
    logger.info("║  Branch:    %-38s ║", report.branch)
    logger.info("║  Commit:    %-38s ║", report.commit[:7])
    logger.info("║  Generated: %-39s║", report.generated_at[:19])
    logger.info("╚══════════════════════════════════════════════════════════╝")
    logger.info("")

    # Summary cards
    total_jobs = report.provider_workflow_counts.get("github", 0) + report.provider_workflow_counts.get("bitbucket", 0)
    dup_count = len(report.duplicate_jobs)
    pr_fb = m.get("pr_feedback_time", {}).get("avg_minutes")
    fail_count = m.get("failed_checks", {}).get("total_failures", 0)
    gate_count = len(report.deploy_gate_events)
    total_runs = m.get("total_runs", 0)

    dup_indicator = "⚠️" if dup_count > 0 else "✅"
    fail_indicator = "❌" if fail_count > 0 else "✅"
    gate_indicator = "❌" if gate_count > 0 else "✅"

    logger.info("  %s Duplicates:       %d lane(s) run across multiple providers", dup_indicator, dup_count)
    logger.info("  ⏱  PR Feedback:      %s avg (%d PR runs)", f"{pr_fb}m" if pr_fb else "N/A", pr_fb or 0)
    logger.info(
        "  %s Failed Checks:     %d / %d (%.1f%%)",
        fail_indicator,
        fail_count,
        total_runs,
        m.get("failed_checks", {}).get("rate_pct", 0),
    )
    logger.info("  %s Deploy Gates:      %d failure(s)", gate_indicator, gate_count)
    logger.info(
        "  📊 Total Jobs:       %d (GH: %d · BB: %d)",
        total_jobs,
        report.provider_workflow_counts.get("github", 0),
        report.provider_workflow_counts.get("bitbucket", 0),
    )
    logger.info("")

    # Duplicate jobs detail
    if report.duplicate_jobs:
        logger.info("  ── Duplicate Lanes ──")
        for d in report.duplicate_jobs:
            logger.info("    • %s: %s", d["lane"], ", ".join(d["providers"]))
            if d.get("github_jobs"):
                logger.info("      GH: %s", ", ".join(d["github_jobs"]))
        logger.info("")

    # Failed checks by lane
    fc = m.get("failed_checks", {})
    if fc.get("by_lane"):
        logger.info("  ── Failed Checks by Lane ──")
        for lane, count in sorted(fc["by_lane"].items(), key=lambda x: -x[1]):
            logger.info("    • %s: %d", lane, count)
        logger.info("")

    # Deploy gate failures
    if report.deploy_gate_events:
        logger.info("  ── Deploy Gate Failures ──")
        for g in report.deploy_gate_events[:5]:
            logger.info("    • %s #%d (%s): %s", g["workflow"], g["run_number"], g["branch"], g["url"])
        logger.info("")

    # PR feedback by workflow
    pr_wf = pr_fb_data = m.get("pr_feedback_time", {}).get("by_workflow", {})
    if pr_wf:
        logger.info("  ── PR Feedback Time by Workflow ──")
        for wf, v in sorted(pr_wf.items(), key=lambda x: -x[1]["count"]):
            avg = v.get("avg_minutes")
            if avg:
                logger.info("    • %s: %.1fm avg (%d runs)", wf, avg, v["count"])
        logger.info("")


# ---------------------------------------------------------------------------
# Main dashboard
# ---------------------------------------------------------------------------


def run_dashboard(
    root: str = ".",
    days: int = 7,
    branch: str | None = None,
    output_path: str | None = None,
    html_path: str | None = None,
    github_token: str | None = None,
    github_repo: str | None = None,
) -> DashboardReport:
    """Run the CI operations dashboard and return the report."""
    logger.info("▸ CI Operations Dashboard")
    logger.info("  Scanning workflows, collecting metrics...")
    logger.info("")

    # 1. Build job inventory from workflow files
    all_jobs, provider_counts = build_job_inventory(root)

    # 2. Find duplicate jobs
    duplicates = find_duplicate_jobs(all_jobs)

    # 3. Collect recent runs from GitHub Actions API
    collector = GitHubActionsCollector(token=github_token, repo=github_repo)
    if branch:
        runs = collector.fetch_recent_runs(branch=branch, days=days)
    else:
        # Detect current branch
        try:
            branch = subprocess.check_output(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"], stderr=subprocess.DEVNULL, text=True
            ).strip()
        except Exception:
            branch = "unknown"
        runs = collector.fetch_recent_runs(branch=branch, days=days)

    # 4. Compute commit hash
    commit = "unknown"
    try:
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"], stderr=subprocess.DEVNULL, text=True).strip()
    except Exception:
        pass

    # 5. Compute metrics
    pr_feedback = compute_pr_feedback_time(runs)
    failed_checks = compute_failed_checks_by_lane(runs, all_jobs)
    deploy_gate_failures = compute_deploy_gate_failures(runs, all_jobs)

    metrics: dict[str, Any] = {
        "total_runs": len(runs),
        "pr_feedback_time": pr_feedback,
        "failed_checks": failed_checks,
        "duplicate_lane_count": len(duplicates),
        "deploy_gate_failure_count": len(deploy_gate_failures),
    }

    # 6. Build report
    generated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    repo_name = collector.repo or github_repo or "unknown"

    report = DashboardReport(
        generated_at=generated_at,
        repo=repo_name,
        branch=branch or "unknown",
        commit=commit,
        metrics=metrics,
        duplicate_jobs=duplicates,
        lane_failures={"by_lane": failed_checks.get("by_lane", {})},
        deploy_gate_events=deploy_gate_failures,
        provider_workflow_counts=provider_counts,
        recent_runs=[
            {
                "name": r.name,
                "status": r.status,
                "conclusion": r.conclusion,
                "url": r.url,
                "event": r.event,
                "branch": r.head_branch,
                "started_at": r.started_at,
                "completed_at": r.completed_at,
            }
            for r in runs[:20]
        ],
    )

    # 7. Output results
    print_terminal_report(report)

    if output_path:
        out_p = Path(output_path)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        with open(out_p, "w") as f:
            json.dump(asdict(report), f, indent=2, default=str)
        logger.info("📄 JSON report saved: %s", out_p)

    if html_path:
        html_p = Path(html_path)
        html_p.parent.mkdir(parents=True, exist_ok=True)
        html_content = generate_html_report(report)
        html_p.write_text(html_content)
        logger.info("📊 HTML dashboard saved: %s", html_p)

    return report


def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="CI Operations Dashboard — track duplicate jobs, PR feedback time, failed checks, deploy gate failures."
    )
    parser.add_argument("--days", type=int, default=7, help="Lookback window in days (default: 7)")
    parser.add_argument("--branch", type=str, default=None, help="Git branch to analyze (default: current)")
    parser.add_argument("--output", type=str, default=None, help="Path to write JSON report")
    parser.add_argument("--html", type=str, default=None, help="Path to write HTML dashboard")
    parser.add_argument("--github-token", type=str, default=None, help="GitHub personal access token")
    parser.add_argument("--github-repo", type=str, default=None, help="GitHub repo slug (owner/name)")
    args = parser.parse_args()

    run_dashboard(
        root=".",
        days=args.days,
        branch=args.branch,
        output_path=args.output,
        html_path=args.html,
        github_token=args.github_token,
        github_repo=args.github_repo,
    )


if __name__ == "__main__":
    main()
