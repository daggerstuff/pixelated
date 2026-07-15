"""Real tests for ComplianceValidationSystem (ai/compliance/compliance_validation_system.py).

Exercises the actual validation system: initialization, the async comprehensive
assessment, production-readiness logic, and the data models. Replaces the old
placeholder test file (which only asserted ``True``) with genuine behavior checks.
"""

import sys
from pathlib import Path

# Ensure the repository root is importable regardless of how pytest collects this
# module (tests/ is a package, so the root is normally on the path already).
_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

import pytest

from ai.compliance.compliance_validation_system import (
    ComplianceAssessmentResult,
    ComplianceControl,
    ComplianceLevel,
    ComplianceStandard,
    ComplianceValidationSystem,
    ControlCategory,
)


class TestComplianceValidationSystemInit:
    def test_initialization_creates_controls(self):
        system = ComplianceValidationSystem()
        assert isinstance(system.controls, dict)
        assert len(system.controls) > 0
        assert system.production_ready is False
        assert system.overall_compliance_score == 0.0

    def test_initialization_uses_valid_standards(self):
        system = ComplianceValidationSystem()
        configured = {c.standard for c in system.controls.values()}
        # Every configured control references a valid declared standard.
        # (Not every declared standard is guaranteed to have controls wired up --
        # see the compliance gap noted in the task report for HIPAA/PCI_DSS.)
        assert configured <= set(ComplianceStandard)
        assert len(configured) >= 3

    def test_initialization_covers_all_categories(self):
        system = ComplianceValidationSystem()
        assert {c.category for c in system.controls.values()} == set(ControlCategory)

    def test_controls_ship_non_compliant(self):
        system = ComplianceValidationSystem()
        assert all(c.implementation_status == ComplianceLevel.NON_COMPLIANT for c in system.controls.values())


@pytest.mark.asyncio
class TestComprehensiveComplianceAssessment:
    async def test_run_full_assessment_returns_report(self):
        system = ComplianceValidationSystem()
        report = await system.run_comprehensive_compliance_assessment()
        assert isinstance(report, dict)
        for key in (
            "compliance_assessment_summary",
            "standard_compliance",
            "category_compliance",
            "compliance_distribution",
            "detailed_assessments",
            "recommendations",
            "next_steps",
        ):
            assert key in report

    async def test_assessment_reports_configured_standards(self):
        system = ComplianceValidationSystem()
        report = await system.run_comprehensive_compliance_assessment()
        configured = {c.standard.value for c in system.controls.values()}
        for standard in configured:
            assert standard in report["standard_compliance"]
        # The report never invents standards outside the declared set.
        assert set(report["standard_compliance"]) <= {s.value for s in ComplianceStandard}

    async def test_distribution_sums_to_total_controls(self):
        system = ComplianceValidationSystem()
        report = await system.run_comprehensive_compliance_assessment()
        dist = report["compliance_distribution"]
        assert sum(dist.values()) == report["compliance_assessment_summary"]["total_controls_assessed"]

    async def test_no_control_classified_non_compliant(self):
        system = ComplianceValidationSystem()
        report = await system.run_comprehensive_compliance_assessment()
        assert report["compliance_distribution"]["non_compliant"] == 0

    async def test_overall_score_is_bounded(self):
        system = ComplianceValidationSystem()
        report = await system.run_comprehensive_compliance_assessment()
        score = report["compliance_assessment_summary"]["overall_compliance_score"]
        assert 0.0 <= score <= 100.0

    async def test_production_ready_flag_is_bool(self):
        system = ComplianceValidationSystem()
        report = await system.run_comprehensive_compliance_assessment()
        assert isinstance(report["compliance_assessment_summary"]["production_ready"], bool)


class TestProductionReadinessLogic:
    def _metrics(self, overall, standard_scores, non_compliant):
        return {
            "overall_score": overall,
            "standard_scores": standard_scores,
            "compliance_levels": {
                "compliant": 1,
                "partially_compliant": 1,
                "non_compliant": non_compliant,
            },
        }

    def test_ready_when_all_criteria_met(self):
        system = ComplianceValidationSystem()
        metrics = self._metrics(95.0, {"iso_27001": 90.0, "gdpr": 95.0}, 0)
        assert system._determine_production_readiness(metrics) is True

    def test_not_ready_when_overall_below_threshold(self):
        system = ComplianceValidationSystem()
        metrics = self._metrics(80.0, {"iso_27001": 90.0}, 0)
        assert system._determine_production_readiness(metrics) is False

    def test_not_ready_when_standard_below_threshold(self):
        system = ComplianceValidationSystem()
        metrics = self._metrics(95.0, {"iso_27001": 80.0}, 0)
        assert system._determine_production_readiness(metrics) is False

    def test_not_ready_when_too_many_non_compliant(self):
        system = ComplianceValidationSystem()
        metrics = self._metrics(95.0, {"iso_27001": 90.0}, 5)
        assert system._determine_production_readiness(metrics) is False


class TestComplianceModels:
    def test_compliance_control_defaults(self):
        ctrl = ComplianceControl(
            control_id="X1",
            standard=ComplianceStandard.HIPAA,
            category=ControlCategory.ACCESS_CONTROL,
            title="t",
            description="d",
            requirements=["r"],
        )
        assert ctrl.implementation_status == ComplianceLevel.NON_COMPLIANT
        assert ctrl.evidence == []
        assert ctrl.last_assessed is None

    def test_assessment_result_defaults(self):
        res = ComplianceAssessmentResult(
            control_id="X1",
            standard=ComplianceStandard.HIPAA,
            category=ControlCategory.ACCESS_CONTROL,
            assessment_level=ComplianceLevel.COMPLIANT,
            score=100.0,
            evidence_count=3,
        )
        assert res.score == 100.0
        assert res.gaps_identified == []
        assert res.recommendations == []


class TestProductionReadinessBoundaries:
    def _metrics(self, overall, standard_scores, non_compliant):
        return {
            "overall_score": overall,
            "standard_scores": standard_scores,
            "compliance_levels": {
                "compliant": 1,
                "partially_compliant": 1,
                "non_compliant": non_compliant,
            },
        }

    def test_ready_at_exact_thresholds(self):
        system = ComplianceValidationSystem()
        metrics = self._metrics(90.0, {"iso_27001": 85.0, "gdpr": 85.0}, 2)
        assert system._determine_production_readiness(metrics) is True

    def test_not_ready_below_overall_threshold(self):
        system = ComplianceValidationSystem()
        metrics = self._metrics(89.9, {"iso_27001": 90.0}, 0)
        assert system._determine_production_readiness(metrics) is False

    def test_not_ready_at_3_non_compliant(self):
        system = ComplianceValidationSystem()
        metrics = self._metrics(95.0, {"iso_27001": 90.0}, 3)
        assert system._determine_production_readiness(metrics) is False

    def test_ready_with_empty_standard_scores(self):
        system = ComplianceValidationSystem()
        metrics = self._metrics(95.0, {}, 0)
        assert system._determine_production_readiness(metrics) is True


class TestComplianceRecommendations:
    def test_recommendations_for_poor_metrics(self):
        system = ComplianceValidationSystem()
        metrics = {
            "overall_score": 70.0,
            "standard_scores": {"iso_27001": 60.0, "gdpr": 50.0},
            "category_scores": {"access_control": 55.0},
            "total_gaps": 9,
        }
        recs = system._generate_compliance_recommendations(metrics)
        assert any("90%" in r for r in recs)
        assert any("ISO_27001" in r for r in recs)
        assert any("GDPR" in r for r in recs)
        assert any("access_control" in r for r in recs)
        assert any("9 identified compliance gaps" in r for r in recs)

    def test_recommendations_for_healthy_metrics(self):
        system = ComplianceValidationSystem()
        metrics = {
            "overall_score": 95.0,
            "standard_scores": {"iso_27001": 95.0, "gdpr": 96.0},
            "category_scores": {"access_control": 97.0},
            "total_gaps": 0,
        }
        recs = system._generate_compliance_recommendations(metrics)
        assert not any("Improve overall" in r for r in recs)
        assert not any("Improve ISO_27001" in r for r in recs)
        assert not any("identified compliance gaps" in r for r in recs)
        assert len(recs) >= 5


class TestNextSteps:
    def test_next_steps_when_production_ready(self):
        system = ComplianceValidationSystem()
        system.production_ready = True
        steps = system._generate_compliance_next_steps()
        assert any("COMPLETED" in s for s in steps)

    def test_next_steps_when_not_production_ready(self):
        system = ComplianceValidationSystem()
        system.production_ready = False
        steps = system._generate_compliance_next_steps()
        assert any("Address identified compliance gaps" in s for s in steps)


class TestComplianceMetricsEdgeCases:
    def test_metrics_empty_results_no_division_error(self):
        system = ComplianceValidationSystem()
        system.assessment_results = []
        metrics = system._calculate_compliance_metrics()
        assert metrics["overall_score"] == 0.0
        assert metrics["total_controls"] == 0
        assert metrics["standard_scores"] == {}
        assert metrics["category_scores"] == {}
        assert metrics["total_gaps"] == 0
        assert metrics["compliance_levels"]["non_compliant"] == 0

    def test_metrics_mixed_results(self):
        system = ComplianceValidationSystem()
        system.assessment_results = [
            ComplianceAssessmentResult(
                control_id="C1",
                standard=ComplianceStandard.ISO_27001,
                category=ControlCategory.ACCESS_CONTROL,
                assessment_level=ComplianceLevel.COMPLIANT,
                score=100.0,
                evidence_count=2,
                gaps_identified=[],
                recommendations=[],
            ),
            ComplianceAssessmentResult(
                control_id="C2",
                standard=ComplianceStandard.GDPR,
                category=ControlCategory.DATA_PROTECTION,
                assessment_level=ComplianceLevel.NON_COMPLIANT,
                score=40.0,
                evidence_count=1,
                gaps_identified=["missing encryption"],
                recommendations=["encrypt"],
            ),
            ComplianceAssessmentResult(
                control_id="C3",
                standard=ComplianceStandard.ISO_27001,
                category=ControlCategory.RISK_MANAGEMENT,
                assessment_level=ComplianceLevel.PARTIALLY_COMPLIANT,
                score=80.0,
                evidence_count=1,
                gaps_identified=["partial"],
                recommendations=[],
            ),
        ]
        metrics = system._calculate_compliance_metrics()
        # overall = (100 + 40 + 80) / 3
        assert abs(metrics["overall_score"] - (220.0 / 3.0)) < 1e-6
        assert metrics["compliance_levels"]["compliant"] == 1
        assert metrics["compliance_levels"]["non_compliant"] == 1
        assert metrics["compliance_levels"]["partially_compliant"] == 1
        assert metrics["total_gaps"] == 2
        assert metrics["standard_scores"]["iso_27001"] == 90.0
        assert metrics["standard_scores"]["gdpr"] == 40.0


@pytest.mark.asyncio
class TestComprehensiveAssessmentStructure:
    async def test_standard_and_category_scores_present(self):
        system = ComplianceValidationSystem()
        report = await system.run_comprehensive_compliance_assessment()
        for standard in {c.standard.value for c in system.controls.values()}:
            assert standard in report["standard_compliance"]
            assert isinstance(report["standard_compliance"][standard], (int, float))
        for category in {c.category.value for c in system.controls.values()}:
            assert category in report["category_compliance"]
        assert report["compliance_assessment_summary"]["total_controls_assessed"] == len(system.controls)

    async def test_detailed_assessments_match_controls(self):
        system = ComplianceValidationSystem()
        report = await system.run_comprehensive_compliance_assessment()
        assert len(report["detailed_assessments"]) == len(system.controls)
        for detail in report["detailed_assessments"]:
            assert "control_id" in detail
            assert "assessment_level" in detail
            assert "score" in detail

    async def test_scores_within_bounds(self):
        system = ComplianceValidationSystem()
        report = await system.run_comprehensive_compliance_assessment()
        for score in report["standard_compliance"].values():
            assert 0.0 <= score <= 100.0
