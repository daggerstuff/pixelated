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


class RejectingModel(FakeModel):
    def load_state_dict(self, _state_dict: dict[str, str]) -> None:
        raise RuntimeError("invalid state dict")


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
        Path(path).write_text("checkpoint")


def create_service(fake_torch: FakeTorch, model_path: Path) -> PyTorchModelService:
    service = PyTorchModelService.__new__(PyTorchModelService)
    service._torch = fake_torch
    service.device = "cpu"
    service.model_path = model_path
    return service


def basic_model_factory(model: FakeModel):
    def create_basic_model(**_kwargs):
        return model

    return create_basic_model


def require_equal(actual: Any, expected: Any) -> None:
    if actual != expected:
        raise AssertionError(f"Expected {expected!r}, got {actual!r}")


def require_true(value: Any) -> None:
    if not value:
        raise AssertionError(f"Expected truthy value, got {value!r}")


def require_is(actual: Any, expected: Any) -> None:
    if actual is not expected:
        raise AssertionError(f"Expected {actual!r} to be {expected!r}")


def require_is_not(actual: Any, expected: Any) -> None:
    if actual is expected:
        raise AssertionError(f"Expected {actual!r} not to be {expected!r}")


def test_save_model_persists_state_dict_checkpoint(tmp_path: Path) -> None:
    fake_torch = FakeTorch()
    service = create_service(fake_torch, tmp_path)
    model = FakeModel()

    service._save_model(model)

    require_equal(fake_torch.saved_path, str(tmp_path / "model.pt.tmp"))
    require_true((tmp_path / "model.pt").exists())
    require_true(not (tmp_path / "model.pt.tmp").exists())
    require_equal(
        fake_torch.saved_checkpoint["format"],  # type: ignore
        PYTORCH_CHECKPOINT_FORMAT,
    )
    require_equal(
        fake_torch.saved_checkpoint["state_dict"],  # type: ignore
        model.state_dict(),
    )
    require_is_not(fake_torch.saved_checkpoint, model)


def test_load_saved_model_restores_state_dict_checkpoint(tmp_path: Path) -> None:
    state_dict = {"classifier.weight": "restored"}
    fake_torch = FakeTorch([{"format": PYTORCH_CHECKPOINT_FORMAT, "state_dict": state_dict}])
    service = create_service(fake_torch, tmp_path)
    model = FakeModel()
    service._create_basic_model = basic_model_factory(model)  # type: ignore

    loaded_model = service._load_saved_model(tmp_path / "model.pt")

    require_is(loaded_model, model)
    require_equal(model.loaded_state_dict, state_dict)
    require_true(fake_torch.load_calls[0]["weights_only"])


def test_load_saved_model_regenerates_invalid_safe_checkpoint(tmp_path: Path) -> None:
    fake_torch = FakeTorch([{"format": PYTORCH_CHECKPOINT_FORMAT, "state_dict": {"bad": "state"}}])
    service = create_service(fake_torch, tmp_path)
    model = RejectingModel()
    service._create_basic_model = basic_model_factory(model)  # type: ignore

    loaded_model = service._load_saved_model(tmp_path / "model.pt")

    require_is(loaded_model, model)
    require_equal(len(fake_torch.load_calls), 1)
    require_true(fake_torch.load_calls[0]["weights_only"])
    require_equal(
        fake_torch.saved_checkpoint["state_dict"],  # type: ignore
        model.state_dict(),
    )


def test_load_saved_model_regenerates_when_safe_checkpoint_load_fails(
    tmp_path: Path,
) -> None:
    fake_torch = FakeTorch(
        [
            RuntimeError("Weights only load failed"),
        ]
    )
    service = create_service(fake_torch, tmp_path)
    model = FakeModel()
    service._create_basic_model = basic_model_factory(model)  # type: ignore

    loaded_model = service._load_saved_model(tmp_path / "model.pt")

    require_is(loaded_model, model)
    require_equal(len(fake_torch.load_calls), 1)
    require_true(fake_torch.load_calls[0]["weights_only"])
    require_equal(
        fake_torch.saved_checkpoint["state_dict"],  # type: ignore
        model.state_dict(),
    )
