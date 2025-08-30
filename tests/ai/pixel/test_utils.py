from pathlib import Path
from ai.pixel.utils.path_utils import get_project_root

def test_get_project_root():
    """Tests that the get_project_root function correctly finds the project root."""
    project_root = get_project_root()
    assert isinstance(project_root, Path)
    assert (project_root / "pyproject.toml").exists()
