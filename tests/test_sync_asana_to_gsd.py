"""Tests for sync_asana_to_gsd.py script."""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch, mock_open

# Add script directory to path
SCRIPT_DIR = Path(__file__).parent.parent / ".agent" / "internal" / "scripts"
sys.path.insert(0, str(SCRIPT_DIR))

import importlib.util

spec = importlib.util.spec_from_file_location(
    "sync_asana_to_gsd", SCRIPT_DIR / "sync_asana_to_gsd.py"
)
assert spec is not None and spec.loader is not None
sync_module = importlib.util.module_from_spec(spec)

mock_requests = MagicMock()
sys.modules["requests"] = mock_requests

with patch.object(Path, "exists", return_value=False):
    with patch.dict(os.environ, {}, clear=False):
        spec.loader.exec_module(sync_module)


class TestFindGsdRoot(unittest.TestCase):
    """Test find_gsd_root function."""

    def test_finds_agent_internal_in_parent(self):
        """Should find .agent/internal when climbing parents."""
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            (root / ".agent" / "internal").mkdir(parents=True)
            subdir = root / "src" / "tests"
            subdir.mkdir(parents=True)

            result = sync_module.find_gsd_root(subdir)
            self.assertEqual(result, root)

    def test_falls_back_to_script_parents(self):
        """Should fallback to script parents if not found."""
        with tempfile.TemporaryDirectory() as tmpdir:
            subdir = Path(tmpdir) / "deep" / "nested"
            subdir.mkdir(parents=True)

            result = sync_module.find_gsd_root(subdir)
            # Should be a valid path (fallback to script parents)
            self.assertIsInstance(result, Path)

    def test_stops_at_root(self):
        """Should stop climbing at filesystem root."""
        with tempfile.TemporaryDirectory() as tmpdir:
            subdir = Path(tmpdir)
            result = sync_module.find_gsd_root(subdir)
            self.assertIsInstance(result, Path)


class TestGetGsdPaths(unittest.TestCase):
    """Test get_gsd_paths function."""

    def test_returns_default_paths_without_workstream(self):
        """Should return standard GSD paths when no workstream."""
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            (root / ".agent" / "internal" / "plans").mkdir(parents=True)

            paths = sync_module.get_gsd_paths(root)

            self.assertEqual(paths["root"], root / ".agent" / "internal")
            self.assertEqual(paths["state"], root / ".agent" / "internal" / "plans" / "STATE.md")
            self.assertEqual(
                paths["roadmap"], root / ".agent" / "internal" / "plans" / "ROADMAP.md"
            )
            self.assertEqual(
                paths["project"], root / ".agent" / "internal" / "plans" / "PROJECT.md"
            )

    def test_returns_workstream_paths(self):
        """Should return workstream-specific paths."""
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            ws_dir = root / ".agent" / "internal" / "workstreams" / "my-ws" / "plans"
            ws_dir.mkdir(parents=True)

            paths = sync_module.get_gsd_paths(root, ws="my-ws")

            self.assertEqual(
                paths["planning"], root / ".agent" / "internal" / "workstreams" / "my-ws"
            )
            self.assertEqual(paths["state"], ws_dir / "STATE.md")

    def test_detects_active_workstream_from_file(self):
        """Should detect active workstream from active-workstream file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            internal = root / ".agent" / "internal"
            (internal / "plans").mkdir(parents=True)
            (internal / "workstreams" / "active-ws" / "plans").mkdir(parents=True)
            (internal / "active-workstream").write_text("active-ws")

            # Clear env var to force file detection
            with patch.dict(os.environ, {"GSD_WORKSTREAM": ""}, clear=False):
                paths = sync_module.get_gsd_paths(root)

            self.assertIn("active-ws", str(paths["planning"]))


class TestParseTaskStatus(unittest.TestCase):
    """Test parse_task_status function."""

    def test_parses_completed_and_incomplete(self):
        """Should correctly count completed vs incomplete tasks."""
        data = {
            "data": [
                {"gid": "1", "name": "Task 1", "completed": True},
                {"gid": "2", "name": "Task 2", "completed": False},
                {"gid": "3", "name": "Task 3", "completed": True},
            ]
        }

        result = sync_module.parse_task_status(data)

        self.assertEqual(result["total"], 3)
        self.assertEqual(result["completed"], 2)
        self.assertEqual(result["incomplete"], 1)
        self.assertEqual(len(result["tasks"]), 3)

    def test_handles_empty_data(self):
        """Should handle empty data gracefully."""
        result = sync_module.parse_task_status({})
        self.assertEqual(result["total"], 0)
        self.assertEqual(result["completed"], 0)

    def test_handles_none_data(self):
        """Should handle None input."""
        result = sync_module.parse_task_status(None)
        self.assertEqual(result["total"], 0)

    def test_handles_missing_data_key(self):
        """Should handle dict without 'data' key."""
        result = sync_module.parse_task_status({"other": "value"})
        self.assertEqual(result["total"], 0)


class TestUpdateGsdState(unittest.TestCase):
    """Test update_gsd_state function."""

    def test_updates_existing_progress_section(self):
        """Should replace existing Asana Progress section."""
        with tempfile.TemporaryDirectory() as tmpdir:
            state_file = Path(tmpdir) / "STATE.md"
            state_file.write_text(
                "# State\n\n## Asana Progress\n\nOld content\n\n## Other Section\n\nMore content"
            )

            status = {"total": 10, "completed": 5, "incomplete": 5}

            with patch.object(sync_module, "STATE_FILE", state_file):
                with patch.object(sync_module, "PROJECT_ID", "test-project"):
                    sync_module.update_gsd_state(status)

            content = state_file.read_text()
            self.assertIn("## Asana Progress", content)
            self.assertIn("Total Tasks | 10", content)
            self.assertIn("Completed | 5", content)
            self.assertIn("**Progress** | **50%**", content)
            self.assertIn("## Other Section", content)  # Preserved

    def test_appends_progress_section_if_missing(self):
        """Should append Asana Progress section if not present."""
        with tempfile.TemporaryDirectory() as tmpdir:
            state_file = Path(tmpdir) / "STATE.md"
            state_file.write_text("# State\n\n## Current Status\n\nSome status")

            status = {"total": 4, "completed": 1, "incomplete": 3}

            with patch.object(sync_module, "STATE_FILE", state_file):
                with patch.object(sync_module, "PROJECT_ID", "test-project"):
                    sync_module.update_gsd_state(status)

            content = state_file.read_text()
            self.assertIn("## Asana Progress", content)
            self.assertIn("**Progress** | **25%**", content)

    def test_handles_missing_state_file(self):
        """Should print warning if state file doesn't exist."""
        with patch.object(sync_module, "STATE_FILE", Path("/nonexistent/STATE.md")):
            with patch("builtins.print") as mock_print:
                sync_module.update_gsd_state({"total": 1, "completed": 0, "incomplete": 1})
            mock_print.assert_called()

    def test_calculates_zero_progress_when_no_tasks(self):
        """Should handle zero total tasks without division error."""
        with tempfile.TemporaryDirectory() as tmpdir:
            state_file = Path(tmpdir) / "STATE.md"
            state_file.write_text("# State")

            status = {"total": 0, "completed": 0, "incomplete": 0}

            with patch.object(sync_module, "STATE_FILE", state_file):
                with patch.object(sync_module, "PROJECT_ID", "test-project"):
                    sync_module.update_gsd_state(status)

            content = state_file.read_text()
            self.assertIn("**Progress** | **0%**", content)


class TestUpdateGsdRoadmap(unittest.TestCase):
    """Test update_gsd_roadmap function."""

    def test_updates_existing_task_breakdown(self):
        """Should replace existing Asana Task Breakdown section."""
        with tempfile.TemporaryDirectory() as tmpdir:
            roadmap_file = Path(tmpdir) / "ROADMAP.md"
            roadmap_file.write_text(
                "# Roadmap\n\n## Asana Task Breakdown\n\nOld breakdown\n\n## Next Steps\n\nMore content"
            )

            status = {"total": 10, "completed": 7, "incomplete": 3}

            with patch.object(sync_module, "ROADMAP_FILE", roadmap_file):
                sync_module.update_gsd_roadmap(status)

            content = roadmap_file.read_text()
            self.assertIn("## Asana Task Breakdown", content)
            self.assertIn("Completed | 7", content)
            self.assertIn("7/10", content)  # Progress bar text
            self.assertIn("## Next Steps", content)  # Preserved

    def test_appends_task_breakdown_if_missing(self):
        """Should append Asana Task Breakdown if not present."""
        with tempfile.TemporaryDirectory() as tmpdir:
            roadmap_file = Path(tmpdir) / "ROADMAP.md"
            roadmap_file.write_text("# Roadmap\n\n## Current Plan\n\nSome plan")

            status = {"total": 4, "completed": 2, "incomplete": 2}

            with patch.object(sync_module, "ROADMAP_FILE", roadmap_file):
                sync_module.update_gsd_roadmap(status)

            content = roadmap_file.read_text()
            self.assertIn("## Asana Task Breakdown", content)
            self.assertIn("2/4", content)

    def test_handles_missing_roadmap_file(self):
        """Should print warning if roadmap file doesn't exist."""
        with patch.object(sync_module, "ROADMAP_FILE", Path("/nonexistent/ROADMAP.md")):
            with patch("builtins.print") as mock_print:
                sync_module.update_gsd_roadmap({"total": 1, "completed": 0, "incomplete": 1})
            mock_print.assert_called()

    def test_progress_bar_renders_correctly(self):
        """Should render progress bar with correct filled/empty slots."""
        with tempfile.TemporaryDirectory() as tmpdir:
            roadmap_file = Path(tmpdir) / "ROADMAP.md"
            roadmap_file.write_text("# Roadmap")

            # 50% should be █████░░░░░
            status = {"total": 10, "completed": 5, "incomplete": 5}

            with patch.object(sync_module, "ROADMAP_FILE", roadmap_file):
                sync_module.update_gsd_roadmap(status)

            content = roadmap_file.read_text()
            self.assertIn("█" * 5, content)  # 5 filled
            self.assertIn("░" * 5, content)  # 5 empty


class TestAsanaApiFunctions(unittest.TestCase):
    """Test Asana API interaction functions."""

    def setUp(self):
        self._orig_requests = sync_module.requests

    def tearDown(self):
        sync_module.requests = self._orig_requests

    def test_test_connection_success(self):
        mock_response = MagicMock()
        mock_response.json.return_value = {"data": {"name": "Test User"}}
        mock_response.raise_for_status.return_value = None
        mock_requests = MagicMock()
        mock_requests.get.return_value = mock_response
        sync_module.requests = mock_requests

        result = sync_module.test_connection("test-token")

        self.assertTrue(result)
        mock_requests.get.assert_called_once()

    def test_test_connection_failure(self):
        class FakeRequestException(Exception):
            pass

        mock_requests = MagicMock()
        mock_requests.exceptions.RequestException = FakeRequestException
        mock_requests.get.side_effect = FakeRequestException("Connection error")
        sync_module.requests = mock_requests

        result = sync_module.test_connection("invalid-token")

        self.assertFalse(result)

    def test_list_projects_success(self):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "data": [
                {"gid": "123", "name": "Project A"},
                {"gid": "456", "name": "Project B"},
            ]
        }
        mock_response.raise_for_status.return_value = None
        mock_requests = MagicMock()
        mock_requests.get.return_value = mock_response
        sync_module.requests = mock_requests

        result = sync_module.list_projects("test-token")

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["name"], "Project A")

    def test_list_projects_failure(self):
        class FakeRequestException(Exception):
            pass

        mock_requests = MagicMock()
        mock_requests.exceptions.RequestException = FakeRequestException
        mock_requests.get.side_effect = FakeRequestException("Error")
        sync_module.requests = mock_requests

        result = sync_module.list_projects("test-token")

        self.assertEqual(result, [])

    def test_fetch_asana_tasks_finds_project(self):
        mock_list = [{"gid": "1213432472298166", "name": "GSD Project"}]

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "data": [
                {"gid": "t1", "name": "Task 1", "completed": False},
                {"gid": "t2", "name": "Task 2", "completed": True},
            ]
        }
        mock_response.raise_for_status.return_value = None
        mock_requests = MagicMock()
        mock_requests.get.return_value = mock_response
        sync_module.requests = mock_requests

        with patch.object(sync_module, "list_projects", return_value=mock_list):
            result = sync_module.fetch_asana_tasks("test-token")

        self.assertEqual(len(result["data"]), 2)

    def test_fetch_asana_tasks_project_not_found(self):
        mock_list = [{"gid": "999", "name": "Other Project"}]

        with patch.object(sync_module, "list_projects", return_value=mock_list):
            result = sync_module.fetch_asana_tasks("test-token")

        self.assertEqual(result["data"], [])


class TestMainFunction(unittest.TestCase):
    """Test main function orchestration."""

    def test_exits_without_token(self):
        """Should exit with error when ASANA_PAT not set."""
        with patch.dict(os.environ, {"ASANA_PAT": ""}, clear=False):
            with patch("sys.exit") as mock_exit:
                with patch("builtins.print"):
                    sync_module.main()
            mock_exit.assert_called_with(1)


if __name__ == "__main__":
    unittest.main()
