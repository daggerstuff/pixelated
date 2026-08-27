"""Unit tests for 5-Dimension WorkLoopAuditor."""

from tools.agent_runner.loop_auditor import WorkLoopAuditor
from tools.agent_runner.models import ActionType, ExecutionResult, LinearIssue, ParsedAction


def test_work_loop_auditor_high_quality_execution():
    auditor = WorkLoopAuditor()
    issue = LinearIssue(
        id="1",
        identifier="PIX-100",
        title="Implement FHIR Patient Encryption",
        description="Encrypt patient records with AES-256.\nAcceptance Criteria: All records encrypted at rest.",
    )
    result = ExecutionResult(
        success=True,
        agent_name="opencode",
        ticket_identifier="PIX-100",
        output="Implementation finished.",
        exit_code=0,
        duration_seconds=4.2,
        verification_passed=True,
        verification_logs="PASSED all 10 tests",
        git_diff_summary="apps/web/src/fhir.ts | +25 -2",
        actions=[ParsedAction(action_type=ActionType.STORE_MEMORY, title="decision", content="Encrypted with AES-256")],
    )

    report = auditor.evaluate_execution(issue, result, is_sandboxed=True, memories_stored=1)
    assert report.overall_score >= 80.0
    assert report.letter_grade in ("A+", "A", "B")
    assert report.is_deliverable is True
    assert "Work Loop Evidence:" in report.summary_badge
    assert "| **Task Understanding** |" in report.markdown_table
    assert "| **Controlled Execution** |" in report.markdown_table
    assert "| **Change Validation** |" in report.markdown_table
    assert "| **Reliable Delivery** |" in report.markdown_table
    assert "| **Learning Capture** |" in report.markdown_table


def test_work_loop_auditor_low_quality_execution():
    auditor = WorkLoopAuditor()
    issue = LinearIssue(
        id="2",
        identifier="PIX-101",
        title="Fix bug",
        description="",
    )
    result = ExecutionResult(
        success=False,
        agent_name="opencode",
        ticket_identifier="PIX-101",
        output="Crashed",
        exit_code=1,
        duration_seconds=0.1,
        verification_passed=False,
        guardrail_violations=["Found @ts-ignore in apps/web/test.ts:12"],
    )

    report = auditor.evaluate_execution(issue, result, is_sandboxed=False)
    assert report.overall_score < 50.0
    assert report.letter_grade in ("F", "C")
    assert report.is_deliverable is False
