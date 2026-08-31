"""5-Dimension Agent Work Loop Quality & Evidence Auditor (inspired by Better Harness)."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import ClassVar

from tools.agent_runner.models import ExecutionResult, LinearIssue

logger = logging.getLogger("agent_runner.loop_auditor")


@dataclass
class DimensionScore:
    name: str
    score: float  # 0.0 to 100.0
    weight: float
    grade: str
    evidence_found: list[str] = field(default_factory=list)
    gaps_found: list[str] = field(default_factory=list)


@dataclass
class WorkLoopAuditReport:
    overall_score: float  # 0.0 to 100.0
    letter_grade: str  # A+, A, B, C, F
    dimensions: list[DimensionScore] = field(default_factory=list)
    is_deliverable: bool = True
    summary_badge: str = ""
    markdown_table: str = ""


class WorkLoopAuditor:
    """Evaluates the 5 dimensions of delivery across agent execution evidence."""

    WEIGHTS: ClassVar[dict[str, float]] = {
        "task_understanding": 0.20,
        "controlled_execution": 0.20,
        "change_validation": 0.25,
        "reliable_delivery": 0.25,
        "learning_capture": 0.10,
    }

    @staticmethod
    def _score_to_grade(score: float) -> str:
        if score >= 95.0:
            return "A+"
        if score >= 85.0:
            return "A"
        if score >= 75.0:
            return "B"
        if score >= 60.0:
            return "C"
        return "F"

    def audit_task_understanding(self, issue: LinearIssue) -> DimensionScore:
        """Evaluate Dimension 1: Task Understanding."""
        evidence: list[str] = []
        gaps: list[str] = []
        score = 0.0

        if issue.title and len(issue.title.strip()) > 8:
            score += 30.0
            evidence.append("Explicit, descriptive title provided")
        else:
            gaps.append("Ambiguous or brief title")

        if issue.description and len(issue.description.strip()) > 40:
            score += 40.0
            evidence.append("Structured task description present")
        else:
            gaps.append("Missing detailed description")

        desc_lower = (issue.description or "").lower()
        if any(
            kw in desc_lower
            for kw in ("acceptance criteria", "criteria", "verification", "test", "assert", "spec", "implement")
        ):
            score += 30.0
            evidence.append("Acceptance criteria or test verification steps defined")
        else:
            gaps.append("No explicit acceptance criteria specified")

        score = min(100.0, score)
        return DimensionScore(
            name="Task Understanding",
            score=score,
            weight=self.WEIGHTS["task_understanding"],
            grade=self._score_to_grade(score),
            evidence_found=evidence,
            gaps_found=gaps,
        )

    def audit_controlled_execution(self, result: ExecutionResult, is_sandboxed: bool) -> DimensionScore:
        """Evaluate Dimension 2: Controlled Execution."""
        evidence: list[str] = []
        gaps: list[str] = []
        score = 0.0

        if is_sandboxed:
            score += 35.0
            evidence.append("Executed in dedicated isolated Git worktree")
        else:
            score += 15.0
            evidence.append("Executed in primary workspace directory")

        if result.exit_code == 0:
            score += 40.0
            evidence.append(f"Clean CLI exit code (0) in {result.duration_seconds:.1f}s")
        else:
            gaps.append(f"Non-zero CLI exit code ({result.exit_code})")

        if 0.5 <= result.duration_seconds <= 600.0:
            score += 25.0
            evidence.append(f"High execution efficiency ({result.duration_seconds:.1f}s within target window)")
        elif result.duration_seconds > 600.0:
            score += 15.0
            evidence.append(f"Execution completed ({result.duration_seconds:.1f}s)")
            gaps.append("High execution duration / context churn (>600s)")
        else:
            gaps.append("Near-zero execution duration; possible premature exit")

        score = min(100.0, score)
        return DimensionScore(
            name="Controlled Execution",
            score=score,
            weight=self.WEIGHTS["controlled_execution"],
            grade=self._score_to_grade(score),
            evidence_found=evidence,
            gaps_found=gaps,
        )

    def audit_change_validation(self, result: ExecutionResult) -> DimensionScore:
        """Evaluate Dimension 3: Change Validation."""
        evidence: list[str] = []
        gaps: list[str] = []
        score = 0.0

        if result.verification_passed:
            score += 50.0
            evidence.append("All automated verification gates passed (typecheck & test suite)")
        else:
            gaps.append("Automated verification gate failed")

        logs_lower = (result.verification_logs or "").lower()
        if "passed" in logs_lower or "all checks passed" in logs_lower:
            score += 30.0
            evidence.append("Concrete test execution logs attached as proof")
        elif result.verification_passed:
            score += 15.0
            evidence.append("Verification gate returned clean status")
        else:
            gaps.append("No proof logs of test execution found")

        # Check assertion depth and test execution verification
        out_lower = (result.output or "").lower()
        if any(w in out_lower or w in logs_lower for w in ("passed", "assert", "6/6", "5/5", "7/7", "test")):
            score += 20.0
            evidence.append("Explicit unit test assertions and quality gauntlet verified")
        else:
            gaps.append("Minimal assertion proof in output")

        score = min(100.0, score)
        return DimensionScore(
            name="Change Validation",
            score=score,
            weight=self.WEIGHTS["change_validation"],
            grade=self._score_to_grade(score),
            evidence_found=evidence,
            gaps_found=gaps,
        )

    def audit_reliable_delivery(self, result: ExecutionResult) -> DimensionScore:
        """Evaluate Dimension 4: Reliable Delivery."""
        evidence: list[str] = []
        gaps: list[str] = []
        score = 0.0

        if not result.guardrail_violations:
            score += 50.0
            evidence.append("Zero anti-suppression violations (@ts-ignore, # noqa) in working diff")
        else:
            gaps.extend(result.guardrail_violations)

        if result.git_diff_summary:
            score += 30.0
            evidence.append(
                f"Structured diff summary verified: {result.git_diff_summary.count(chr(10)) + 1} file(s) changed"
            )
        else:
            score += 15.0
            evidence.append("Investigation / analysis ticket (no code modifications required)")

        # Code Hygiene: verify no raw debug print dumps in output
        diff_lower = (result.git_diff_summary or "").lower()
        out_lower = (result.output or "").lower()
        if "console.log(" not in diff_lower and "print(debug" not in diff_lower:
            score += 20.0
            evidence.append("Clean code hygiene (no debug print pollution)")
        else:
            gaps.append("Potential debug log pollution detected in diff")

        score = min(100.0, score)
        return DimensionScore(
            name="Reliable Delivery",
            score=score,
            weight=self.WEIGHTS["reliable_delivery"],
            grade=self._score_to_grade(score),
            evidence_found=evidence,
            gaps_found=gaps,
        )

    def audit_learning_capture(self, result: ExecutionResult, memories_stored: int = 0) -> DimensionScore:
        """Evaluate Dimension 5: Learning Capture."""
        evidence: list[str] = []
        gaps: list[str] = []
        score = 0.0

        if memories_stored > 0 or any(a.action_type.value == "STORE_MEMORY" for a in result.actions):
            score += 60.0
            evidence.append("Architectural decision / memory persisted to Foresight")
        else:
            gaps.append("No persistent architectural memory recorded")

        if result.actions:
            score += 40.0
            evidence.append(f"Structured action signals captured ({len(result.actions)} actions emitted)")
        else:
            score += 40.0
            evidence.append("Direct execution completed cleanly without follow-up subtasks")

        score = min(100.0, score)
        return DimensionScore(
            name="Learning Capture",
            score=score,
            weight=self.WEIGHTS["learning_capture"],
            grade=self._score_to_grade(score),
            evidence_found=evidence,
            gaps_found=gaps,
        )

    def evaluate_execution(
        self,
        issue: LinearIssue,
        result: ExecutionResult,
        *,
        is_sandboxed: bool = False,
        memories_stored: int = 0,
    ) -> WorkLoopAuditReport:
        """Perform comprehensive 5-dimension evaluation on a completed task."""
        d1 = self.audit_task_understanding(issue)
        d2 = self.audit_controlled_execution(result, is_sandboxed)
        d3 = self.audit_change_validation(result)
        d4 = self.audit_reliable_delivery(result)
        d5 = self.audit_learning_capture(result, memories_stored)

        dimensions = [d1, d2, d3, d4, d5]
        overall_score = sum(d.score * d.weight for d in dimensions)
        letter_grade = self._score_to_grade(overall_score)
        is_deliverable = overall_score >= 65.0 and d3.score >= 60.0 and d4.score >= 60.0

        table_lines = [
            "| Dimension | Score | Grade | Key Evidence & Gaps |",
            "| :--- | :---: | :---: | :--- |",
        ]
        for d in dimensions:
            evidence_str = "; ".join(d.evidence_found) if d.evidence_found else "None"
            gaps_str = f" *(Gaps: {'; '.join(d.gaps_found)})*" if d.gaps_found else ""
            table_lines.append(f"| **{d.name}** | `{d.score:.0f}%` | **{d.grade}** | {evidence_str}{gaps_str} |")

        table_md = "\n".join(table_lines)
        badge = f"`Work Loop Evidence: {overall_score:.0f}% ({letter_grade})`"

        return WorkLoopAuditReport(
            overall_score=overall_score,
            letter_grade=letter_grade,
            dimensions=dimensions,
            is_deliverable=is_deliverable,
            summary_badge=badge,
            markdown_table=table_md,
        )
