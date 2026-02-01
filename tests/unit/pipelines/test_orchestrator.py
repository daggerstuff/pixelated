from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from ai.pipelines.orchestrator.data_splitter import DatasetSplit
from ai.pipelines.orchestrator.main_orchestrator import DatasetPipelineOrchestrator


@pytest.fixture
def orchestrator():
    return DatasetPipelineOrchestrator()


@patch("ai.pipelines.orchestrator.main_orchestrator.run_unified_pipeline")
def test_run_unified_preprocessing(mock_run, orchestrator):
    mock_run.return_value = "/path/to/dataset.jsonl"
    result = orchestrator.run_unified_preprocessing()
    assert result == "/path/to/dataset.jsonl"
    assert orchestrator.pipeline_results["unified_dataset_path"] == "/path/to/dataset.jsonl"


@patch("ai.pipelines.orchestrator.main_orchestrator.run_composition")
def test_run_dataset_composition(mock_run, orchestrator):
    mock_run.return_value = ("/path/to/balanced.jsonl", {"stats": "dummy"})
    path, report = orchestrator.run_dataset_composition("/path/to/input.jsonl")
    assert path == "/path/to/balanced.jsonl"
    assert report == {"stats": "dummy"}


@patch("builtins.open")
@patch("ai.pipelines.orchestrator.data_splitter.DataSplitter.split")
def test_run_data_splitting(mock_split, mock_open_func, orchestrator):
    mock_split.return_value = DatasetSplit(
        train=[{"id": 1}], val=[{"id": 2}], test=[], metadata={"total": 2}
    )

    # Create a mock file object that returns lines when iterated and has a write method
    mock_file = MagicMock()
    # Mocking iteration
    mock_file.__iter__.return_value = ['{"id": 1}\n', '{"id": 2}\n']
    # Mocking readline if needed
    mock_file.readline.side_effect = ['{"id": 1}\n', '{"id": 2}\n', ""]

    mock_open_func.return_value.__enter__.return_value = mock_file

    with patch("pathlib.Path.parent", return_value=Path("/tmp")), patch("pathlib.Path.mkdir"):
        result = orchestrator.run_data_splitting("/tmp/balanced.jsonl")
        assert "train" in result
        assert "val" in result
        assert "test" in result
        # Check if write was called
        assert mock_file.write.called
