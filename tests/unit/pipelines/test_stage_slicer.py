"""
Tests for PIX-35: Stage-Based Dataset Slicing.

Tests cover:
- StageClassifier: classification logic for all 5 stages
- StageCounts: aggregation and counting
- DatasetSlicer: full pipeline with manifest generation
- Edge cases: empty inputs, missing fields, invalid JSON
"""

import json
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest

from ai.core.pipelines.processing.dataset_slicer import (
    DatasetSlicer,
    SliceManifest,
    SliceResult,
)
from ai.core.pipelines.processing.stage_classifier import (
    ClassificationResult,
    Stage,
    StageClassifier,
    StageCounts,
)


def _write_jsonl_records(file_path: Path, records: list[dict]) -> None:
    """Write records to a JSONL file."""
    with file_path.open("w", encoding="utf-8") as file_obj:
        for record in records:
            file_obj.write(json.dumps(record, ensure_ascii=False) + "\n")


def _write_jsonl_batches(input_dir: Path, records: list[dict], batch_count: int) -> None:
    """Write multiple JSONL batch files with the same record set."""
    for batch_index in range(batch_count):
        file_path = input_dir / f"batch_{batch_index}.jsonl"
        _write_jsonl_records(file_path, records)


def _assert_stage_files_contain_valid_jsonl(stage_files: dict[str, Path]) -> None:
    """Assert all existing stage files contain valid JSONL lines."""
    for stage_file in stage_files.values():
        if not stage_file.exists():
            continue

        with stage_file.open("r", encoding="utf-8") as file_obj:
            for line in file_obj:
                if line.strip():
                    json.loads(line)


def _count_non_empty_jsonl_lines(file_path: Path) -> int:
    """Count non-empty JSONL lines in a file."""
    with file_path.open("r", encoding="utf-8") as file_obj:
        return sum(bool(line.strip()) for line in file_obj)


# -------------------------------------------------------------------
# Fixtures
# -------------------------------------------------------------------


@pytest.fixture
def sample_records() -> list[dict]:
    """Sample records representing different content types."""
    return [
        # Stage 1: Foundation - academic source
        {
            "source": "pubmed",
            "content_type": "reference",
            "metadata": {
                "topic_tags": ["psychology", "mental_health"],
            },
        },
        # Stage 1: Foundation - conversational
        {
            "source": "openalex",
            "content_type": "conversational",
            "metadata": {
                "topic_tags": ["wellness"],
            },
        },
        # Stage 2: Therapeutic Expertise - CBT
        {
            "source": "clinical_trials",
            "content_type": "clinical",
            "metadata": {
                "therapeutic_modality": "CBT",
                "topic_tags": ["therapy", "clinical"],
            },
        },
        # Stage 2: Therapeutic Expertise - DBT
        {
            "source": "therapy_dataset",
            "content_type": "case_study",
            "metadata": {
                "therapeutic_modality": "DBT",
                "topic_tags": ["diagnosis", "treatment_plan"],
            },
        },
        # Stage 3: Edge/Stress Test - adversarial
        {
            "source": "adversarial",
            "content_type": "stress_test",
            "metadata": {
                "topic_tags": ["edge_case", "safety"],
            },
        },
        # Stage 3: Edge/Stress Test - red_team
        {
            "source": "red_team",
            "content_type": "reference",
            "metadata": {
                "topic_tags": ["jailbreak"],
            },
        },
        # Stage 4: Voice/Persona
        {
            "source": "pixel_voice",
            "content_type": "conversational",
            "metadata": {
                "topic_tags": ["persona", "voice"],
            },
        },
        # Stage 4: Voice/Persona - dual_persona
        {
            "source": "dual_persona",
            "content_type": "role_play",
            "metadata": {
                "topic_tags": ["character_voice"],
            },
        },
        # Supplementary - no matching indicators
        {
            "source": "unknown_source",
            "content_type": "general",
            "metadata": {
                "topic_tags": ["miscellaneous"],
            },
        },
        # Edge case: missing metadata
        {
            "source": "minimal_record",
            "content_type": "instructional",
        },
    ]


@pytest.fixture
def temp_output_dir() -> Iterator[Path]:
    """Create a temporary directory for test outputs."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def temp_jsonl_file(sample_records, temp_output_dir) -> Path:
    """Create a temporary JSONL file with sample records."""
    jsonl_path = temp_output_dir / "test_input.jsonl"
    with jsonl_path.open("w", encoding="utf-8") as f:
        for record in sample_records:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    return jsonl_path


# -------------------------------------------------------------------
# Stage Enum Tests
# -------------------------------------------------------------------


class TestStageEnum:
    """Tests for the Stage enum."""

    def test_stage_values(self):
        """Verify all stage values are defined correctly."""
        assert Stage.STAGE1_FOUNDATION.value == "stage1_foundation"
        assert Stage.STAGE2_THERAPEUTIC_EXPERTISE.value == "stage2_therapeutic_expertise"
        assert Stage.STAGE3_EDGE_STRESS_TEST.value == "stage3_edge_stress_test"
        assert Stage.STAGE4_VOICE_PERSONA.value == "stage4_voice_persona"
        assert Stage.SUPPLEMENTARY.value == "supplementary"

    def test_stage_count(self):
        """Verify we have exactly 5 stages."""
        assert len(Stage) == 5

    def test_stage_is_string_enum(self):
        """Verify Stage is a string enum."""
        assert isinstance(Stage.STAGE1_FOUNDATION, str)
        assert Stage.STAGE1_FOUNDATION.upper() == "STAGE1_FOUNDATION"


# -------------------------------------------------------------------
# StageCounts Tests
# -------------------------------------------------------------------


class TestStageCounts:
    """Tests for StageCounts dataclass."""

    def test_default_counts(self):
        """Verify default counts are zero."""
        counts = StageCounts()
        assert counts.stage1_foundation == 0
        assert counts.stage2_therapeutic_expertise == 0
        assert counts.stage3_edge_stress_test == 0
        assert counts.stage4_voice_persona == 0
        assert counts.supplementary == 0

    def test_increment(self):
        """Test incrementing stage counts."""
        counts = StageCounts()
        counts.increment(Stage.STAGE1_FOUNDATION)
        assert counts.stage1_foundation == 1

        counts.increment(Stage.STAGE1_FOUNDATION)
        assert counts.stage1_foundation == 2

        counts.increment(Stage.STAGE4_VOICE_PERSONA)
        assert counts.stage4_voice_persona == 1

    def test_total(self):
        """Test total count calculation."""
        counts = StageCounts()
        counts.increment(Stage.STAGE1_FOUNDATION)
        counts.increment(Stage.STAGE2_THERAPEUTIC_EXPERTISE)
        counts.increment(Stage.SUPPLEMENTARY)

        assert counts.total() == 3

    def test_to_dict(self):
        """Test conversion to dictionary."""
        counts = StageCounts()
        counts.increment(Stage.STAGE1_FOUNDATION)
        counts.increment(Stage.STAGE1_FOUNDATION)
        counts.increment(Stage.SUPPLEMENTARY)

        result = counts.to_dict()

        assert result["stage1_foundation"] == 2
        assert result["supplementary"] == 1
        assert result["stage2_therapeutic_expertise"] == 0
        assert isinstance(result, dict)


# -------------------------------------------------------------------
# ClassificationResult Tests
# -------------------------------------------------------------------


class TestClassificationResult:
    """Tests for ClassificationResult dataclass."""

    def test_basic_result(self):
        """Test creating a basic classification result."""
        result = ClassificationResult(
            stage=Stage.STAGE1_FOUNDATION,
            confidence=0.85,
            reasons=["Content type: conversational"],
        )

        assert result.stage == Stage.STAGE1_FOUNDATION
        assert result.confidence == 0.85
        assert len(result.reasons) == 1

    def test_default_reasons(self):
        """Test default empty reasons list."""
        result = ClassificationResult(
            stage=Stage.SUPPLEMENTARY,
            confidence=0.5,
        )

        assert result.reasons == []


# -------------------------------------------------------------------
# StageClassifier Tests
# -------------------------------------------------------------------


class TestStageClassifier:
    """Tests for StageClassifier."""

    def test_classify_stage1_foundation_academic_source(self):
        """Test classification of foundation content with academic source."""
        classifier = StageClassifier()

        record = {
            "source": "pubmed",
            "content_type": "reference",
            "metadata": {},
        }

        result = classifier.classify(record)

        assert result.stage == Stage.STAGE1_FOUNDATION
        assert result.confidence >= 0.65
        assert any("Academic source" in r for r in result.reasons)

    def test_classify_stage1_foundation_topic_tags(self):
        """Test classification based on foundation topic tags."""
        classifier = StageClassifier()

        record = {
            "source": "unknown",
            "content_type": "conversational",
            "metadata": {
                "topic_tags": ["psychology", "mental_health"],
            },
        }

        result = classifier.classify(record)

        assert result.stage == Stage.STAGE1_FOUNDATION
        assert any("topic_tags" in r.lower() or "foundation" in r.lower() for r in result.reasons)

    def test_classify_stage2_therapeutic_modality(self):
        """Test classification based on therapeutic modality."""
        classifier = StageClassifier()

        record = {
            "source": "clinical_trials",
            "content_type": "clinical",
            "metadata": {
                "therapeutic_modality": "CBT",
                "topic_tags": ["therapy"],
            },
        }

        result = classifier.classify(record)

        assert result.stage == Stage.STAGE2_THERAPEUTIC_EXPERTISE
        assert any("CBT" in r or "modality" in r.lower() for r in result.reasons)

    def test_classify_stage2_multiple_therapeutic_tags(self):
        """Test classification with multiple therapeutic topic tags."""
        classifier = StageClassifier()

        record = {
            "source": "therapy",
            "content_type": "case_study",
            "metadata": {
                "topic_tags": ["therapy", "clinical", "diagnosis"],
            },
        }

        result = classifier.classify(record)

        assert result.stage == Stage.STAGE2_THERAPEUTIC_EXPERTISE

    def test_classify_stage3_edge_case_source(self):
        """Test classification of edge case content by source."""
        classifier = StageClassifier()

        record = {
            "source": "adversarial",
            "content_type": "reference",
            "metadata": {},
        }

        result = classifier.classify(record)

        assert result.stage == Stage.STAGE3_EDGE_STRESS_TEST
        assert result.confidence >= 0.85

    def test_classify_stage3_edge_case_tags(self):
        """Test classification based on edge case topic tags."""
        classifier = StageClassifier()

        record = {
            "source": "test_data",
            "content_type": "stress_test",
            "metadata": {
                "topic_tags": ["jailbreak", "crisis"],
            },
        }

        result = classifier.classify(record)

        assert result.stage == Stage.STAGE3_EDGE_STRESS_TEST

    def test_classify_stage4_voice_persona_source(self):
        """Test classification of voice/persona content by source."""
        classifier = StageClassifier()

        record = {
            "source": "pixel_voice",
            "content_type": "conversational",
            "metadata": {},
        }

        result = classifier.classify(record)

        assert result.stage == Stage.STAGE4_VOICE_PERSONA
        assert result.confidence >= 0.85

    def test_classify_stage4_voice_persona_tags(self):
        """Test classification based on voice/persona topic tags."""
        classifier = StageClassifier()

        record = {
            "source": "training_data",
            "content_type": "role_play",
            "metadata": {
                "topic_tags": ["persona", "character_voice"],
            },
        }

        result = classifier.classify(record)

        assert result.stage == Stage.STAGE4_VOICE_PERSONA

    def test_classify_supplementary_default(self):
        """Test that unclassified content defaults to supplementary."""
        classifier = StageClassifier()

        record = {
            "source": "unknown_source",
            "content_type": "general",
            "metadata": {
                "topic_tags": ["miscellaneous"],
            },
        }

        result = classifier.classify(record)

        assert result.stage == Stage.SUPPLEMENTARY
        assert result.confidence == 0.5

    def test_classify_missing_metadata(self):
        """Test classification with missing metadata field."""
        classifier = StageClassifier()

        record = {
            "source": "minimal",
            "content_type": "instructional",
        }

        result = classifier.classify(record)

        # Should classify as foundation due to content_type
        assert result.stage == Stage.STAGE1_FOUNDATION

    def test_classify_empty_record(self):
        """Test classification with minimal/empty record."""
        classifier = StageClassifier()

        record = {}

        result = classifier.classify(record)

        assert result.stage == Stage.SUPPLEMENTARY

    def test_classify_priority_order(self):
        """Test that stage priority order is correct (4 > 3 > 2 > 1 > supp)."""
        classifier = StageClassifier()

        # Record that could match multiple stages
        record = {
            "source": "pixel_voice",  # Stage 4
            "content_type": "stress_test",  # Stage 3
            "metadata": {
                "therapeutic_modality": "CBT",  # Stage 2
                "topic_tags": ["psychology"],  # Stage 1
            },
        }

        result = classifier.classify(record)

        # Stage 4 should win
        assert result.stage == Stage.STAGE4_VOICE_PERSONA

    def test_classify_batch(self):
        """Test batch classification."""
        classifier = StageClassifier()

        records = [
            {"source": "pubmed", "content_type": "reference", "metadata": {}},
            {"source": "pixel_voice", "content_type": "conversational", "metadata": {}},
            {"source": "unknown", "content_type": "general", "metadata": {}},
        ]

        classified, counts = classifier.classify_batch(records)

        assert len(classified) == 3
        assert counts.total() == 3
        assert counts.stage1_foundation >= 1
        assert counts.stage4_voice_persona >= 1

    def test_classify_batch_with_target_caps(self):
        """Test batch classification with target enforcement."""
        classifier = StageClassifier(
            stage_targets={"stage1_foundation": 1},
            enforce_targets=True,
        )

        records = [
            {"source": "pubmed", "content_type": "reference", "metadata": {}},
            {"source": "zenodo", "content_type": "instructional", "metadata": {}},
            {"source": "openalex", "content_type": "conversational", "metadata": {}},
        ]

        _classified, counts = classifier.classify_batch(records)

        # Only 1 should be stage1, rest demoted to supplementary
        assert counts.stage1_foundation == 1
        assert counts.supplementary >= 2

    def test_case_insensitive_matching(self):
        """Test that matching is case-insensitive."""
        classifier = StageClassifier()

        record = {
            "source": "PUBMED",  # Uppercase
            "content_type": "REFERENCE",  # Uppercase
            "metadata": {
                "therapeutic_modality": "cbt",  # Lowercase
                "topic_tags": ["PSYCHOLOGY"],  # Uppercase
            },
        }

        result = classifier.classify(record)

        # Should still classify correctly
        assert result.stage in [Stage.STAGE1_FOUNDATION, Stage.STAGE2_THERAPEUTIC_EXPERTISE]


# -------------------------------------------------------------------
# SliceManifest Tests
# -------------------------------------------------------------------


class TestSliceManifest:
    """Tests for SliceManifest dataclass."""

    def test_to_dict(self):
        """Test conversion to dictionary."""
        manifest = SliceManifest(
            slice_id="test-slice-001",
            created_at="2025-01-01T00:00:00Z",
            input_files=["file1.jsonl", "file2.jsonl"],
            stage_targets={"stage1_foundation": 100},
            stage_counts={"stage1_foundation": 50, "supplementary": 10},
            total_records=60,
            classified_records=60,
            supplementary_records=10,
            rejection_reasons={"json_parse_error": 2},
            classification_confidence_avg=0.75,
            processing_time_seconds=1.5,
        )

        result = manifest.to_dict()

        assert result["slice_id"] == "test-slice-001"
        assert result["total_records"] == 60
        assert isinstance(result, dict)


# -------------------------------------------------------------------
# SliceResult Tests
# -------------------------------------------------------------------


class TestSliceResult:
    """Tests for SliceResult dataclass."""

    def test_summary(self):
        """Test summary generation."""
        manifest = SliceManifest(
            slice_id="test-slice",
            created_at="2025-01-01T00:00:00Z",
            input_files=["input.jsonl"],
            stage_targets={},
            stage_counts={"stage1_foundation": 10, "supplementary": 5},
            total_records=15,
            classified_records=15,
            supplementary_records=5,
        )

        result = SliceResult(
            manifest=manifest,
            output_dir=Path("/tmp/output"),
            stage_files={"stage1_foundation": Path("/tmp/output/stage1_foundation.jsonl")},
        )

        summary = result.summary()

        assert "PIX-35 Dataset Slice Result" in summary
        assert "test-slice" in summary
        assert "stage1_foundation: 10" in summary


# -------------------------------------------------------------------
# DatasetSlicer Tests
# -------------------------------------------------------------------


class TestDatasetSlicer:
    """Tests for DatasetSlicer."""

    def test_slice_basic(self, temp_jsonl_file, temp_output_dir):
        """Test basic slicing operation."""
        slicer = DatasetSlicer(output_dir=temp_output_dir)

        result = slicer.slice([temp_jsonl_file], slice_id="test-basic")

        assert result.manifest.slice_id == "test-basic"
        assert result.manifest.total_records > 0
        assert result.manifest.classified_records == result.manifest.total_records
        assert result.output_dir == temp_output_dir

    def test_slice_creates_stage_files(self, temp_jsonl_file, temp_output_dir):
        """Test that slicing creates stage-specific output files."""
        slicer = DatasetSlicer(output_dir=temp_output_dir)

        slicer.slice([temp_jsonl_file])

        # Verify all stage files exist
        assert all((temp_output_dir / f"{stage.value}.jsonl").exists() for stage in Stage)

    def test_slice_creates_manifest(self, temp_jsonl_file, temp_output_dir):
        """Test that slicing creates a manifest file."""
        slicer = DatasetSlicer(output_dir=temp_output_dir)

        slicer.slice([temp_jsonl_file])

        manifest_path = temp_output_dir / "slice_manifest.json"
        assert manifest_path.exists()

        # Verify manifest is valid JSON
        with manifest_path.open("r", encoding="utf-8") as f:
            manifest_data = json.load(f)

        assert "slice_id" in manifest_data
        assert "stage_counts" in manifest_data

    def test_slice_with_targets(self, temp_jsonl_file, temp_output_dir):
        """Test slicing with stage targets."""
        slicer = DatasetSlicer(
            stage_targets={"stage1_foundation": 1},
            enforce_targets=False,  # Don't enforce, just track
            output_dir=temp_output_dir,
        )

        result = slicer.slice([temp_jsonl_file])

        # Should have recorded targets
        assert "stage1_foundation" in result.manifest.stage_targets

    def test_slice_empty_input(self, temp_output_dir):
        """Test slicing with empty input file."""
        empty_file = temp_output_dir / "empty.jsonl"
        empty_file.touch()

        slicer = DatasetSlicer(output_dir=temp_output_dir)

        result = slicer.slice([empty_file])

        assert result.manifest.total_records == 0
        assert result.manifest.classified_records == 0

    def test_slice_invalid_json(self, temp_output_dir):
        """Test handling of invalid JSON in input."""
        bad_file = temp_output_dir / "bad.jsonl"
        with bad_file.open("w") as f:
            f.write('{"valid": true}\n')
            f.write("this is not json\n")
            f.write('{"also_valid": true}\n')

        slicer = DatasetSlicer(output_dir=temp_output_dir)

        result = slicer.slice([bad_file])

        # Should process valid records and track errors
        assert result.manifest.total_records == 2  # Only 2 valid records
        assert "json_parse_error" in result.manifest.rejection_reasons
        assert result.manifest.rejection_reasons["json_parse_error"] == 1

    def test_slice_directory_input(self, sample_records, temp_output_dir):
        """Test slicing with directory as input."""
        input_dir = temp_output_dir / "input"
        input_dir.mkdir()

        # Create multiple JSONL files
        _write_jsonl_batches(input_dir, sample_records[:5], batch_count=2)

        output_dir = temp_output_dir / "output"
        slicer = DatasetSlicer(output_dir=output_dir)

        result = slicer.slice([input_dir])

        assert result.manifest.total_records == 10  # 5 records x 2 files
        assert len(result.manifest.input_files) == 2

    def test_slice_auto_slice_id(self, temp_jsonl_file, temp_output_dir):
        """Test automatic slice ID generation."""
        slicer = DatasetSlicer(output_dir=temp_output_dir)

        result = slicer.slice([temp_jsonl_file])  # No slice_id provided

        assert result.manifest.slice_id.startswith("slice-")

    def test_slice_processes_all_stages(self, sample_records, temp_output_dir):
        """Test that records are distributed across stages."""
        # Create input with records for all stages
        jsonl_path = temp_output_dir / "all_stages.jsonl"
        _write_jsonl_records(jsonl_path, sample_records)

        slicer = DatasetSlicer(output_dir=temp_output_dir)
        result = slicer.slice([jsonl_path])

        # Verify we have records in multiple stages
        non_zero_stages = [
            stage for stage, count in result.manifest.stage_counts.items() if count > 0
        ]
        assert len(non_zero_stages) >= 3, "Expected records in at least 3 different stages"

    def test_slice_confidence_tracking(self, temp_jsonl_file, temp_output_dir):
        """Test that average confidence is tracked."""
        slicer = DatasetSlicer(output_dir=temp_output_dir)

        result = slicer.slice([temp_jsonl_file])

        assert result.manifest.classification_confidence_avg > 0
        assert result.manifest.classification_confidence_avg <= 1.0

    def test_slice_processing_time(self, temp_jsonl_file, temp_output_dir):
        """Test that processing time is recorded."""
        slicer = DatasetSlicer(output_dir=temp_output_dir)

        result = slicer.slice([temp_jsonl_file])

        assert result.manifest.processing_time_seconds >= 0


# -------------------------------------------------------------------
# Integration Tests
# -------------------------------------------------------------------


class TestIntegration:
    """Integration tests for the full slicing pipeline."""

    def test_full_pipeline(self, sample_records, temp_output_dir):
        """Test the complete pipeline from records to sliced output."""
        # Create input file
        input_file = temp_output_dir / "input.jsonl"
        _write_jsonl_records(input_file, sample_records)

        # Run slicer
        output_dir = temp_output_dir / "sliced"
        slicer = DatasetSlicer(
            stage_targets={
                "stage1_foundation": 100,
                "stage2_therapeutic_expertise": 50,
            },
            output_dir=output_dir,
        )

        result = slicer.slice([input_file], slice_id="integration-test")

        # Verify outputs
        assert result.manifest.slice_id == "integration-test"
        assert result.manifest.total_records == len(sample_records)

        # Verify stage files contain valid JSONL
        _assert_stage_files_contain_valid_jsonl(result.stage_files)

    def test_roundtrip_counts(self, sample_records, temp_output_dir):
        """Test that counts match record distribution."""
        input_file = temp_output_dir / "input.jsonl"
        _write_jsonl_records(input_file, sample_records)

        output_dir = temp_output_dir / "sliced"
        slicer = DatasetSlicer(output_dir=output_dir)
        result = slicer.slice([input_file])

        # Count records in stage files
        total_in_files = sum(
            _count_non_empty_jsonl_lines(stage_file)
            for stage_file in result.stage_files.values()
            if stage_file.exists()
        )

        # Should match total_records
        assert total_in_files == result.manifest.total_records
