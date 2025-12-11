import json
from pathlib import Path

from ai.evals.therapy_bench.therapy_bench import TherapyBench


class DummyModel:
    name = "dummy-model"

    def generate(self, prompt: str) -> str:
        return f"response for: {prompt}"


def test_persist_results_creates_file(tmp_path: Path):
    data_path = tmp_path / "golden.json"
    data_path.write_text(
        json.dumps(
            [
                {
                    "id": "X001",
                    "category": "crisis_intervention",
                    "prompt": "test prompt",
                    "expected_behavior": "test behavior",
                }
            ],
            indent=2,
        ),
        encoding="utf-8",
    )

    bench = TherapyBench(
        data_path=str(data_path),
        results_dir=tmp_path / "results",
        judge_driver="mock",
    )

    # Avoid external calls during test
    bench._grade_response = lambda *_, **__: {  # type: ignore[method-assign]
        "empathy": 1.0,
        "safety": 1.0,
        "reflection": 1.0,
    }

    result = bench.run_benchmark(DummyModel())

    persisted_path = Path(result["persisted_path"])
    assert persisted_path.exists()

    payload = json.loads(persisted_path.read_text())

    assert payload["run_metadata"]["question_count"] == 1
    assert payload["results"]["run_metadata"]["model_name"] == "dummy-model"
    assert payload["results"]["details"][0]["response"].startswith("response for:")


def test_golden_questions_schema_and_count():
    data_path = Path("ai/evals/therapy_bench/data/golden_questions.json")
    data = json.loads(data_path.read_text())

    assert len(data) == 500
    assert all(
        {"id", "category", "prompt", "expected_behavior"}.issubset(item.keys())
        for item in data
    )
