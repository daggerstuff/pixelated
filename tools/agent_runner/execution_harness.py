"""Robust Autonomous Agent Execution & Verification Harness.

Enforces:
1. Pre-execution grounding (AGENTS.md, Foresight user preferences & semantic memories).
2. Worktree isolation with clean baseline tracking.
3. 6-Stage Gating Gauntlet:
   - Stage 1: Anti-Hollow & Anti-Cheating Gate (0-diff rejection, fake mock detection, implementation balance).
   - Stage 2: Strict Anti-Suppression Gate (@ts-ignore, @ts-nocheck, # noqa, /* eslint-disable */).
   - Stage 3: Auto-Formatting Gate (Prettier, oxfmt).
   - Stage 4: Type-Aware Linter Gate (oxlint --type-aware, ruff check).
   - Stage 5: Real Unit & Integration Testing Gate (vitest, pytest).
   - Stage 6: LangSmith Trace & Telemetry Gate.
4. Auto-Repair Closed-Loop Feedback.
"""

from __future__ import annotations

import logging
import os
import subprocess
import time
from dataclasses import dataclass, field
from typing import Any

from tools.agent_runner.adapters import get_agent_adapter
from tools.agent_runner.event_bus import EventBus, EventType
from tools.agent_runner.foresight_bridge import ForesightBridge
from tools.agent_runner.guardrails import GuardrailsEngine
from tools.agent_runner.hitl_proxy import EscalationStore
from tools.agent_runner.langchain_tracer import LangChainAgentTracer
from tools.agent_runner.loop_auditor import WorkLoopAuditor, WorkLoopAuditReport
from tools.agent_runner.models import AgentConfig, ExecutionResult, LinearIssue, RunnerConfig
from tools.agent_runner.self_evolution import SelfEvolutionEngine
from tools.agent_runner.state_graph import AgentState
from tools.agent_runner.trace_analyzer import TraceAnalyzer, TraceSummary
from tools.agent_runner.verifier import VerificationEngine

logger = logging.getLogger("agent_runner.harness")


@dataclass
class GateResult:
    stage_name: str
    passed: bool
    details: str
    duration_seconds: float = 0.0
    failures: list[str] = field(default_factory=list)


@dataclass
class HarnessRunReport:
    ticket_identifier: str
    agent_name: str
    overall_passed: bool
    stages: list[GateResult] = field(default_factory=list)
    repair_attempts: int = 0
    worktree_path: str = ""
    modified_files: list[str] = field(default_factory=list)
    audit_report: WorkLoopAuditReport | None = None
    trace_summary: TraceSummary | None = None
    summary_markdown: str = ""


class AgentExecutionHarness:
    """Rigorous execution harness running subagents through the 6-stage verification gauntlet."""

    def __init__(
        self,
        config: RunnerConfig,
        foresight: ForesightBridge | None = None,
        tracer: LangChainAgentTracer | None = None,
        event_bus: EventBus | None = None,
        self_evolution: SelfEvolutionEngine | None = None,
    ):
        self.config = config
        self.foresight = foresight or ForesightBridge(enabled=config.enable_foresight_memory)
        self.tracer = tracer or LangChainAgentTracer(
            project_name=config.langchain_project,
            enabled=config.enable_langchain_tracing,
        )
        self.event_bus = event_bus or EventBus()
        self.evolution = self_evolution or SelfEvolutionEngine(self.foresight, self.event_bus)
        self.guardrails = GuardrailsEngine(config=config.guardrails)
        self.loop_auditor = WorkLoopAuditor()
        self.trace_analyzer = TraceAnalyzer(config.langchain_project)
        self.verifier = VerificationEngine(config=config.verification)
        self.escalation_store = EscalationStore()

    def run_harness(
        self,
        agent_cfg: AgentConfig,
        issue: LinearIssue,
        workdir: str,
        prompt: str,
        parent_trace: Any | None = None,
    ) -> tuple[ExecutionResult, HarnessRunReport]:
        """Execute agent in worktree and evaluate through all 6 quality gates with auto-repair."""
        adapter = get_agent_adapter(agent_cfg)
        ticket_trace = parent_trace or self.tracer.start_ticket_execution_trace(None, None, agent_cfg, issue)

        report = HarnessRunReport(
            ticket_identifier=issue.identifier,
            agent_name=agent_cfg.name,
            overall_passed=False,
            worktree_path=workdir,
        )

        max_repairs = self.config.verification.max_repair_attempts if self.config.verification.auto_repair else 0
        current_prompt = prompt
        execution_result = ExecutionResult(
            agent_name=agent_cfg.name,
            ticket_identifier=issue.identifier,
            success=False,
            output="",
            stderr="",
        )

        for attempt in range(max_repairs + 1):
            report.repair_attempts = attempt
            logger.info(
                "Executing harness attempt %d/%d for %s with agent %s...",
                attempt + 1,
                max_repairs + 1,
                issue.identifier,
                agent_cfg.name,
            )

            raw_result = adapter.run(
                prompt=current_prompt,
                workdir=workdir,
                ticket_identifier=issue.identifier,
                enable_branching=False,
            )
            self.tracer.record_agent_cli(ticket_trace, agent_cfg, current_prompt, raw_result)

            # Evaluate all 6 quality gates
            gate_results, modified_files = self._run_quality_gauntlet(workdir, raw_result, issue)
            report.stages = gate_results
            report.modified_files = modified_files

            all_passed = all(g.passed for g in gate_results)
            if all_passed and raw_result.success:
                logger.info(
                    "✅ All 6 harness quality gates PASSED for %s on attempt %d!",
                    issue.identifier,
                    attempt + 1,
                )
                raw_result.verification_passed = True
                report.overall_passed = True
                execution_result = raw_result
                break

            # Collect failure diagnostics for repair prompt
            failures = []
            for g in gate_results:
                if not g.passed:
                    failures.extend(g.failures)

            logger.warning(
                "❌ Harness gates failed for %s on attempt %d: %s",
                issue.identifier,
                attempt + 1,
                failures[:3],
            )

            if attempt < max_repairs:
                logger.info(
                    "🔄 Formulating targeted diagnostic repair prompt for attempt %d...",
                    attempt + 2,
                )
                repair_details = "\n".join(f"- {f}" for f in failures)
                current_prompt = (
                    f"PREVIOUS ATTEMPT FAILED QUALITY GATES (Attempt {attempt + 1}/{max_repairs + 1}):\n\n"
                    f"The following failures MUST be fixed immediately:\n"
                    f"{repair_details}\n\n"
                    f"Original Task: {issue.title}\n{issue.description}\n\n"
                    f"MANDATORY INSTRUCTIONS:\n"
                    f"1. Fix the root cause in the code files. Do NOT use fake mocks or suppression comments.\n"
                    f"2. Auto-format all modified files.\n"
                    f"3. Run tests locally and ensure they pass.\n"
                )
                self.event_bus.publish(
                    EventType.AUTO_REPAIR_TRIGGERED,
                    agent_name=agent_cfg.name,
                    ticket_identifier=issue.identifier,
                    payload={"attempt": attempt + 1, "failures": failures},
                )
            else:
                raw_result.verification_passed = False
                report.overall_passed = False
                execution_result = raw_result

                # Human-in-the-Loop Breakpoint: Serialize state snapshot for terminal intervention
                esc_state = AgentState(
                    task_id=issue.identifier,
                    task_description=f"{issue.title}\n{issue.description or ''}",
                    file_paths=modified_files,
                    current_code=raw_result.git_diff_summary,
                    reviewer_feedback=failures,
                    iteration_count=attempt + 1,
                    max_iterations=max_repairs + 1,
                    status="escalated",
                    active_agent=agent_cfg.name,
                    developer_agent=agent_cfg.name,
                    reviewer_agent="QA_Reviewer",
                    escalation_id=None,
                    metadata={"issue_id": issue.id},
                )
                esc_id = self.escalation_store.create_escalation(esc_state)
                logger.warning(
                    "🚨 Human-in-the-Loop Breakpoint: task %s escalated to EscalationStore (ID: %s)",
                    issue.identifier,
                    esc_id,
                )

        # Populate concrete verification logs if clean
        if report.overall_passed and not execution_result.verification_logs:
            logs_summary = "\n".join(
                f"Gate {g.stage_name}: {'PASSED' if g.passed else 'FAILED'}" for g in report.stages
            )
            execution_result.verification_logs = f"All 6 harness quality gates PASSED:\n{logs_summary}"

        # Persist memory to Foresight on clean delivery
        memories_stored = 0
        if report.overall_passed:
            try:
                self.foresight.store_decision(
                    category="decision",
                    content=f"{issue.title}: Implementation verified and passed all quality gates.",
                    ticket_ref=issue.identifier,
                )
                memories_stored += 1
            except Exception as e:
                logger.warning("Could not persist Foresight decision memory: %s", e)

        # Post-execution audit and trace analysis
        report.trace_summary = self.trace_analyzer.analyze_ticket_trace(issue.identifier)
        report.audit_report = self.loop_auditor.evaluate_execution(
            issue, execution_result, is_sandboxed=True, memories_stored=memories_stored
        )
        report.summary_markdown = self._generate_report_markdown(report)

        # Distill friction into Foresight
        if not report.overall_passed or report.repair_attempts > 0:
            self.evolution.process_execution_friction(
                issue=issue,
                agent_name=agent_cfg.name,
                result=execution_result,
                repair_attempts=report.repair_attempts,
            )

        return execution_result, report

    def _stage1_anti_hollow(
        self, workdir: str, all_touched: list[str], result: ExecutionResult, issue: LinearIssue
    ) -> GateResult:
        s_start = time.time()
        failures = []
        if not all_touched and result.success:
            failures.append("Zero files modified in worktree despite claiming completion.")

        for fpath in all_touched:
            full_path = os.path.join(workdir, fpath)
            if os.path.isfile(full_path) and fpath.endswith((".ts", ".tsx", ".js", ".py")):
                try:
                    with open(full_path, encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                        if ("seededRandom" in content or "Math.random()" in content) and "test" not in fpath:
                            failures.append(f"Fake pseudo-random generator detected in production file {fpath}.")
                        if "placeholder implementation" in content.lower() or "todo: implement" in content.lower():
                            failures.append(f"Unimplemented placeholder stub detected in {fpath}.")
                except Exception as e:
                    logger.debug("Could not inspect file %s: %s", fpath, e)

        test_files = [f for f in all_touched if "test" in f or "spec" in f]
        prod_files = [
            f for f in all_touched if "test" not in f and "spec" not in f and f.endswith((".ts", ".tsx", ".py"))
        ]
        if (
            test_files
            and not prod_files
            and any(kw in issue.title.lower() for kw in ["implement", "add", "build", "create", "feature"])
        ):
            failures.append(
                "Hollow PR detected: Only test files were added/modified for a feature implementation ticket."
            )

        return GateResult(
            stage_name="Stage 1: Anti-Hollow & Anti-Cheating Gate",
            passed=len(failures) == 0,
            details="Passed anti-mock and substantiveness validation."
            if not failures
            else "Failed anti-hollow validation.",
            duration_seconds=time.time() - s_start,
            failures=failures,
        )

    def _stage2_anti_suppression(self, workdir: str, all_touched: list[str], result: ExecutionResult) -> GateResult:
        s_start = time.time()
        failures = self.guardrails.audit_code_diff_for_suppressions(result.git_diff_summary)
        for fpath in all_touched:
            full_path = os.path.join(workdir, fpath)
            if os.path.isfile(full_path):
                try:
                    with open(full_path, encoding="utf-8", errors="ignore") as f:
                        lines = f.readlines()
                        for i, line in enumerate(lines, 1):
                            if any(
                                bad in line
                                for bad in [
                                    "@ts-ignore",
                                    "@ts-nocheck",
                                    "@ts-expect-error",
                                    "# noqa",
                                    "# type: ignore",
                                    "/* eslint-disable",
                                ]
                            ):
                                failures.append(f"{fpath}:{i} Contains forbidden suppression tag: {line.strip()}")
                except Exception as e:
                    logger.debug("Could not audit file %s: %s", fpath, e)

        return GateResult(
            stage_name="Stage 2: Strict Anti-Suppression Gate",
            passed=len(failures) == 0,
            details="Zero suppression tags found."
            if not failures
            else f"{len(failures)} suppression violations detected.",
            duration_seconds=time.time() - s_start,
            failures=failures,
        )

    def _stage3_auto_formatting(self, workdir: str, ts_files: list[str]) -> GateResult:
        s_start = time.time()
        failures = []
        if ts_files:
            fmt_res = subprocess.run(
                ["pnpm", "exec", "prettier", "--write", *ts_files],
                cwd=workdir,
                capture_output=True,
                text=True,
                check=False,
            )
            if fmt_res.returncode != 0:
                failures.append(f"Prettier formatting failed: {fmt_res.stderr[:200]}")

        return GateResult(
            stage_name="Stage 3: Auto-Formatting Gate",
            passed=len(failures) == 0,
            details="All modified files formatted to project standard." if not failures else "Formatting check failed.",
            duration_seconds=time.time() - s_start,
            failures=failures,
        )

    def _stage4_type_linting(self, workdir: str, ts_files: list[str], py_files: list[str]) -> GateResult:
        s_start = time.time()
        failures = []
        if ts_files:
            lint_res = subprocess.run(
                ["pnpm", "exec", "oxlint", "--type-aware", "-c", ".oxlintrc.json", *ts_files],
                cwd=workdir,
                capture_output=True,
                text=True,
                check=False,
            )
            if lint_res.returncode != 0:
                failures.append(f"oxlint failed:\n{lint_res.stderr or lint_res.stdout[:500]}")

        if py_files:
            ruff_res = subprocess.run(
                ["uv", "run", "ruff", "check", *py_files],
                cwd=workdir,
                capture_output=True,
                text=True,
                check=False,
            )
            if ruff_res.returncode != 0:
                failures.append(f"ruff check failed:\n{ruff_res.stdout[:500]}")

        return GateResult(
            stage_name="Stage 4: Type-Aware Linter Gate",
            passed=len(failures) == 0,
            details="0 linter errors across all modified files." if not failures else "Linting errors detected.",
            duration_seconds=time.time() - s_start,
            failures=failures,
        )

    def _stage5_testing(self, workdir: str, all_touched: list[str]) -> GateResult:
        s_start = time.time()
        failures = []
        test_ts = [f for f in all_touched if f.endswith((".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"))]
        for tf in test_ts:
            vitest_res = subprocess.run(
                ["pnpm", "vitest", "run", "--coverage.enabled=false", "-c", "config/vitest.config.ts", tf],
                cwd=workdir,
                capture_output=True,
                text=True,
                check=False,
            )
            if vitest_res.returncode != 0:
                failures.append(f"Vitest test suite failed for {tf}:\n{vitest_res.stdout[-600:]}")

        test_py = [f for f in all_touched if f.endswith(".py") and ("test" in f or "tests" in f)]
        for pf in test_py:
            pytest_res = subprocess.run(
                ["uv", "run", "pytest", pf, "-q"],
                cwd=workdir,
                capture_output=True,
                text=True,
                check=False,
            )
            if pytest_res.returncode != 0:
                failures.append(f"Pytest suite failed for {pf}:\n{pytest_res.stdout[-600:]}")

        return GateResult(
            stage_name="Stage 5: Unit & Integration Testing Gate",
            passed=len(failures) == 0,
            details=f"All {len(test_ts) + len(test_py)} test suites passed."
            if not failures
            else "Test failures encountered.",
            duration_seconds=time.time() - s_start,
            failures=failures,
        )

    def _stage6_trace_telemetry(self, issue: LinearIssue) -> GateResult:
        s_start = time.time()
        failures = []
        trace_sum = self.trace_analyzer.analyze_ticket_trace(issue.identifier)
        if trace_sum and trace_sum.anomalies:
            failures.extend(trace_sum.anomalies)

        return GateResult(
            stage_name="Stage 6: LangSmith Trace & Telemetry Gate",
            passed=len(failures) == 0,
            details="Trace execution verified clean without anomalies."
            if not failures
            else "Trace anomalies detected.",
            duration_seconds=time.time() - s_start,
            failures=failures,
        )

    def _run_quality_gauntlet(
        self,
        workdir: str,
        result: ExecutionResult,
        issue: LinearIssue,
    ) -> tuple[list[GateResult], list[str]]:
        """Run the comprehensive 6-stage verification gauntlet."""
        if not self.config.verification.enabled:
            return [
                GateResult(
                    stage_name="All Quality Gates (Disabled)",
                    passed=True,
                    details="Verification explicitly disabled in configuration.",
                )
            ], []

        status_res = subprocess.run(
            ["git", "status", "--porcelain"], cwd=workdir, capture_output=True, text=True, check=False
        )
        changed_files = [line.strip().split()[-1] for line in status_res.stdout.splitlines() if line.strip()]
        diff_res = subprocess.run(
            ["git", "diff", "HEAD", "--name-only"], cwd=workdir, capture_output=True, text=True, check=False
        )
        all_touched = list(set(changed_files + [f.strip() for f in diff_res.stdout.splitlines() if f.strip()]))

        ts_files = [f for f in all_touched if f.endswith((".ts", ".tsx", ".astro", ".js", ".jsx", ".json"))]
        py_files = [f for f in all_touched if f.endswith(".py")]

        gates = [
            self._stage1_anti_hollow(workdir, all_touched, result, issue),
            self._stage2_anti_suppression(workdir, all_touched, result),
            self._stage3_auto_formatting(workdir, ts_files),
            self._stage4_type_linting(workdir, ts_files, py_files),
            self._stage5_testing(workdir, all_touched),
            self._stage6_trace_telemetry(issue),
        ]

        return gates, all_touched

    def _generate_report_markdown(self, report: HarnessRunReport) -> str:
        """Generate GitHub/Linear formatted Markdown scorecard for the harness run."""
        status_icon = "✅ **PASSED**" if report.overall_passed else "❌ **FAILED**"
        lines = [
            f"### 🛡️ Autonomous Execution Harness Scorecard: {status_icon}",
            f"- **Ticket**: `{report.ticket_identifier}`",
            f"- **Agent**: `{report.agent_name}`",
            f"- **Repair Attempts**: `{report.repair_attempts}`",
            f"- **Modified Files**: `{len(report.modified_files)} files`",
            "",
            "| Stage | Status | Details | Duration |",
            "|---|---|---|---|",
        ]
        for g in report.stages:
            icon = "✅ Pass" if g.passed else "❌ Fail"
            lines.append(f"| **{g.stage_name}** | {icon} | {g.details} | `{g.duration_seconds:.2f}s` |")

        if not report.overall_passed:
            lines.extend(["", "#### ⚠️ Blocking Failures:"])
            for g in report.stages:
                if not g.passed:
                    for f in g.failures:
                        lines.append(f"- `{g.stage_name}`: {f}")

        return "\n".join(lines)
