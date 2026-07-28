"""Tests for the DiagnosisArena evaluation suite, PIX-3909."""

from __future__ import annotations

from pathlib import Path

import pytest

from ai.evals.diagnosis_arena import (
    DiagnosisArenaBenchmark,
    Difficulty,
    EvaluationReport,
    GeneratedDiagnosis,
    JudgmentResult,
    Leaderboard,
    OpenAIBenchmarkPipeline,
    ResponseFormat,
    SystemEvaluation,
    TierScore,
    case_from_dict,
    classify_errors,
    inter_rater_agreement,
)

FIXTURE = Path("ai/evals/diagnosis_arena/fixtures/seed_cases.jsonl")


def mock_producer(label):
    def _produce(case, fmt):
        return GeneratedDiagnosis(
            response_id=f"{label}-{case.case_id}",
            case_id=case.case_id,
            format=fmt,
            hypothesis_list=list(case.differential_diagnoses) or ["mocked hypothesis"],
            differential_list=list(case.differential_diagnoses),
            evidence_cited=list(case.supporting_evidence),
            final_diagnosis=case.final_diagnosis if case.mcq_options else "",
            reasoning="mocked reasoning",
            mcq_selected=case.mcq_options[0] if fmt == ResponseFormat.MCQ and case.mcq_options else "",
        )

    return _produce


class TestBenchmark:
    def test_loads_seed_fixture(self):
        if not FIXTURE.exists():
            pytest.skip("seed fixture not present")
        benchmark = DiagnosisArenaBenchmark.from_jsonl(FIXTURE)
        assert len(benchmark) >= 100

    def test_difficulty_distribution(self):
        if not FIXTURE.exists():
            pytest.skip("seed fixture not present")
        benchmark = DiagnosisArenaBenchmark.from_jsonl(FIXTURE)
        counts = {d.value: 0 for d in Difficulty}
        for case in benchmark:
            counts[case.difficulty.value] += 1
        assert counts["simple"] + counts["moderate"] + counts["complex"] == len(benchmark)
        assert counts["simple"] >= 20

    def test_by_difficulty_filter(self):
        if not FIXTURE.exists():
            pytest.skip("seed fixture not present")
        benchmark = DiagnosisArenaBenchmark.from_jsonl(FIXTURE)
        simple = benchmark.by_difficulty(Difficulty.SIMPLE)
        assert all(c.difficulty is Difficulty.SIMPLE for c in simple)


class TestJudge:
    def test_heuristic_identical(self):
        from ai.evals.diagnosis_arena.judge import HeuristicJudge

        judge = HeuristicJudge()
        case = case_from_dict(
            {
                "case_id": "t1",
                "difficulty": "simple",
                "presentation": "x",
                "final_diagnosis": "Streptococcal pharyngitis",
                "differential_diagnoses": ["Streptococcal pharyngitis"],
                "supporting_evidence": ["rapid strep"],
                "key_differentiators": ["rapid strep"],
            }
        )
        response = GeneratedDiagnosis(
            response_id="r1",
            case_id="t1",
            format=ResponseFormat.OPEN_ENDED,
            final_diagnosis="Streptococcal pharyngitis",
            differential_list=["Streptococcal pharyngitis"],
            evidence_cited=["rapid strep"],
        )
        result = judge.judge(case, response)
        assert result.tier == TierScore.IDENTICAL

    def test_inter_rater_agreement(self):
        votes = [
            JudgmentResult(
                response_id="r",
                case_id="c",
                tier=TierScore.IDENTICAL,
                dimensions=tuple(("hypothesis_generation", 1.0, "") for _ in range(4)),
                error_tags=(),
                latency_ms=1.0,
                judge_model="x",
            ),
            JudgmentResult(
                response_id="r",
                case_id="c",
                tier=TierScore.IDENTICAL,
                dimensions=tuple(("hypothesis_generation", 1.0, "") for _ in range(4)),
                error_tags=(),
                latency_ms=2.0,
                judge_model="x",
            ),
            JudgmentResult(
                response_id="r",
                case_id="c",
                tier=TierScore.IDENTICAL,
                dimensions=tuple(("hypothesis_generation", 1.0, "") for _ in range(4)),
                error_tags=(),
                latency_ms=3.0,
                judge_model="x",
            ),
        ]
        assert inter_rater_agreement(votes) == 1.0


class TestErrorTaxonomy:
    def test_classify_irrelevant(self):
        case = case_from_dict(
            {
                "case_id": "e1",
                "difficulty": "simple",
                "presentation": "x",
                "final_diagnosis": "A",
                "differential_diagnoses": ["A", "B"],
                "supporting_evidence": ["ev_a"],
                "key_differentiators": [],
            }
        )
        response = GeneratedDiagnosis(response_id="r", case_id="e1", format=ResponseFormat.OPEN_ENDED)
        errors = classify_errors(case, response, TierScore.IRRELEVANT)
        assert "irrelevant" in errors


class TestPipeline:
    def test_multi_system_run(self):
        if not FIXTURE.exists() or len(open(FIXTURE, encoding="utf-8").readlines()) < 10:
            pytest.skip("need fixture with >=10 cases")
        benchmark = DiagnosisArenaBenchmark.from_jsonl(FIXTURE)
        systems = {
            "baseline": mock_producer("baseline"),
            "system_b": mock_producer("system_b"),
        }
        pipeline = OpenAIBenchmarkPipeline(
            benchmark=benchmark,
            systems=systems,
            formats=(ResponseFormat.OPEN_ENDED,),
        )
        results = pipeline.run()
        assert len(results) == 2
        leaderboard = pipeline.summarize()
        assert leaderboard.rank("baseline") >= 1

    def test_reports_written(self, tmp_path):
        if not FIXTURE.exists() or len(open(FIXTURE, encoding="utf-8").readlines()) < 10:
            pytest.skip("need fixture with >=10 cases")
        benchmark = DiagnosisArenaBenchmark.from_jsonl(FIXTURE)
        pipeline = OpenAIBenchmarkPipeline(
            benchmark=benchmark,
            systems={"only": mock_producer("only")},
            formats=(ResponseFormat.OPEN_ENDED,),
        )
        pipeline.run()
        outputs = pipeline.write_reports(tmp_path)
        assert (tmp_path / "leaderboard.md").exists()
        assert (tmp_path / "leaderboard.json").exists()


class TestLeaderboard:
    def test_ranking(self):
        s1 = SystemEvaluation(
            label="a",
            system="a",
            summary=EvaluationReport(
                model_label="a",
                format=ResponseFormat.OPEN_ENDED,
                total_cases=10,
                total_generations=10,
                tier_distribution={},
                dimension_stats={},
                overall_accuracy=0.9,
                open_ended_accuracy=0.9,
                mcq_accuracy=0.0,
                difficulty_breakdown={},
                error_taxonomy_counts={},
                latency_p95_ms=10.0,
                raw_judgments=(),
            ),
        )
        s2 = SystemEvaluation(
            label="b",
            system="b",
            summary=EvaluationReport(
                model_label="b",
                format=ResponseFormat.OPEN_ENDED,
                total_cases=10,
                total_generations=10,
                tier_distribution={},
                dimension_stats={},
                overall_accuracy=0.7,
                open_ended_accuracy=0.7,
                mcq_accuracy=0.0,
                difficulty_breakdown={},
                error_taxonomy_counts={},
                latency_p95_ms=10.0,
                raw_judgments=(),
            ),
        )
        lb = Leaderboard([s1, s2])
        assert lb.rank("a") == 1
        assert lb.rank("b") == 2
