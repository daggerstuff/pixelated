import asyncio
from typing import Any

from bias_detection.models import BiasType
from bias_detection.services.model_service import (
    KeywordBiasModelService,
    ModelEnsembleService,
)


class FailingModelService:
    model_name = "failing_optional_model"

    async def load_model(self) -> bool:
        return False

    async def predict(self, _text: str) -> dict[str, Any]:
        raise RuntimeError("optional model unavailable")

    def get_model_info(self) -> dict[str, Any]:
        return {
            "name": self.model_name,
            "framework": "test",
            "loaded": False,
        }


def test_ensemble_loads_keyword_fallback_when_local_ml_is_disabled() -> None:
    async def run() -> None:
        ensemble = ModelEnsembleService()

        loaded = await ensemble.load_all_models()
        prediction = await ensemble.predict_ensemble("The elderly woman was ignored.")

        assert loaded is True
        assert ensemble.services
        assert any(isinstance(service, KeywordBiasModelService) for service in ensemble.services)
        assert prediction["models_used"] == 1
        assert any(result["bias_type"] == BiasType.AGE for result in prediction["ensemble_results"])

    asyncio.run(run())


def test_ensemble_continues_when_optional_model_fails_to_load() -> None:
    async def run() -> None:
        fallback = KeywordBiasModelService()
        ensemble = ModelEnsembleService.__new__(ModelEnsembleService)
        ensemble.services = [FailingModelService(), fallback]
        ensemble.tf_service = None
        ensemble.pt_service = fallback  # type: ignore
        ensemble.nvidia_service = None
        ensemble.keyword_service = fallback

        loaded = await ensemble.load_all_models()
        prediction = await ensemble.predict_ensemble("The young man was selected.")

        assert loaded is True
        assert prediction["models_used"] == 1
        assert any(result["bias_type"] == BiasType.GENDER for result in prediction["ensemble_results"])

    asyncio.run(run())
