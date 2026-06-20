import tempfile
import unittest
from pathlib import Path
from typing import Any

from bias_detection.services.model_service import (
    PYTORCH_CHECKPOINT_FORMAT,
    PyTorchModelService,
)


class FakeModel:
    def __init__(self) -> None:
        self.loaded_state_dict = None

    def state_dict(self) -> dict[str, str]:
        return {"classifier.weight": "weights"}

    def load_state_dict(self, state_dict: dict[str, str]) -> None:
        self.loaded_state_dict = state_dict


class FakeTorch:
    def __init__(self, load_results: list[Any] | None = None) -> None:
        self.load_results = load_results or []
        self.load_calls = []
        self.saved_checkpoint = None
        self.saved_path = None

    def load(
        self,
        model_file: Path,
        *,
        map_location: str,
        weights_only: bool,
    ) -> Any:
        self.load_calls.append(
            {
                "model_file": model_file,
                "map_location": map_location,
                "weights_only": weights_only,
            }
        )
        result = self.load_results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result

    def save(self, checkpoint: dict[str, Any], path: str) -> None:
        self.saved_checkpoint = checkpoint
        self.saved_path = path


def create_service(fake_torch: FakeTorch, model_path: Path) -> PyTorchModelService:
    service = PyTorchModelService.__new__(PyTorchModelService)
    service._torch = fake_torch
    service.device = "cpu"
    service.model_path = model_path
    return service


class TestPyTorchModelServicePersistence(unittest.TestCase):
    def test_save_model_persists_state_dict_checkpoint(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            model_path = Path(temp_dir)
            fake_torch = FakeTorch()
            service = create_service(fake_torch, model_path)
            model = FakeModel()

            service._save_model(model)

            self.assertEqual(fake_torch.saved_path, str(model_path / "model.pt"))
            self.assertEqual(
                fake_torch.saved_checkpoint["format"],
                PYTORCH_CHECKPOINT_FORMAT,
            )
            self.assertEqual(
                fake_torch.saved_checkpoint["state_dict"],
                model.state_dict(),
            )
            self.assertIsNot(fake_torch.saved_checkpoint, model)

    def test_load_saved_model_restores_state_dict_checkpoint(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            state_dict = {"classifier.weight": "restored"}
            fake_torch = FakeTorch([{"format": PYTORCH_CHECKPOINT_FORMAT, "state_dict": state_dict}])
            service = create_service(fake_torch, Path(temp_dir))
            model = FakeModel()
            service._create_basic_model = lambda: model

            loaded_model = service._load_saved_model(Path(temp_dir) / "model.pt")

            self.assertIs(loaded_model, model)
            self.assertEqual(model.loaded_state_dict, state_dict)
            self.assertTrue(fake_torch.load_calls[0]["weights_only"])

    def test_load_saved_model_regenerates_unloadable_legacy_pickle(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            fake_torch = FakeTorch(
                [
                    AttributeError(
                        "Can't get local object 'PyTorchModelService._create_basic_model.<locals>.BiasDetectionModel'"
                    ),
                ]
            )
            service = create_service(fake_torch, Path(temp_dir))
            model = FakeModel()
            service._create_basic_model = lambda: model

            loaded_model = service._load_saved_model(Path(temp_dir) / "model.pt")

            self.assertIs(loaded_model, model)
            self.assertTrue(fake_torch.load_calls[0]["weights_only"])
            self.assertEqual(
                fake_torch.saved_checkpoint["state_dict"],
                model.state_dict(),
            )

    def test_load_saved_model_regenerates_full_model_pickle(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            fake_torch = FakeTorch([RuntimeError("unsupported global")])
            service = create_service(fake_torch, Path(temp_dir))
            model = FakeModel()
            service._create_basic_model = lambda: model

            loaded_model = service._load_saved_model(Path(temp_dir) / "model.pt")

            self.assertIs(loaded_model, model)
            self.assertEqual(len(fake_torch.load_calls), 1)
            self.assertTrue(fake_torch.load_calls[0]["weights_only"])
            self.assertEqual(
                fake_torch.saved_checkpoint["state_dict"],
                model.state_dict(),
            )
