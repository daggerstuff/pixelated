"""
Model service for TensorFlow and PyTorch integration
"""

from __future__ import annotations

import hashlib
import os
import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import TYPE_CHECKING, Any

import numpy as np
import structlog

if TYPE_CHECKING:
    import tensorflow as tf
    import torch

TRANSFORMER_IMPORT_ATTEMPTED = False
TRANSFORMERS_AVAILABLE = False
AutoTokenizer = None
BertModel = None
TFBertForSequenceClassification = None

TENSORFLOW_IMPORT_ATTEMPTED = False
TENSORFLOW_AVAILABLE = False
_tensorflow_module: Any | None = None

TORCH_IMPORT_ATTEMPTED = False
TORCH_AVAILABLE = False
_torch_module: Any | None = None


def _transformer_available() -> bool:
    _load_transformers()
    return (
        TRANSFORMERS_AVAILABLE and AutoTokenizer is not None and BertModel is not None
    )


def _load_transformers() -> None:
    global TRANSFORMER_IMPORT_ATTEMPTED
    global TRANSFORMERS_AVAILABLE
    global AutoTokenizer
    global BertModel
    global TFBertForSequenceClassification

    if TRANSFORMER_IMPORT_ATTEMPTED:
        return

    TRANSFORMER_IMPORT_ATTEMPTED = True

    try:
        from transformers import AutoTokenizer, BertModel
        from transformers import TFBertForSequenceClassification

        TRANSFORMERS_AVAILABLE = True
    except Exception:
        AutoTokenizer = None
        BertModel = None
        TFBertForSequenceClassification = None
        TRANSFORMERS_AVAILABLE = False


def _load_tensorflow() -> Any | None:
    global TENSORFLOW_IMPORT_ATTEMPTED
    global TENSORFLOW_AVAILABLE
    global _tensorflow_module

    if TENSORFLOW_IMPORT_ATTEMPTED:
        return _tensorflow_module

    TENSORFLOW_IMPORT_ATTEMPTED = True

    try:
        import tensorflow as tf

        _tensorflow_module = tf
        TENSORFLOW_AVAILABLE = True
    except ImportError:
        _tensorflow_module = None
        TENSORFLOW_AVAILABLE = False

    return _tensorflow_module


def _load_torch() -> Any | None:
    global TORCH_IMPORT_ATTEMPTED
    global TORCH_AVAILABLE
    global _torch_module

    if TORCH_IMPORT_ATTEMPTED:
        return _torch_module

    TORCH_IMPORT_ATTEMPTED = True

    try:
        import torch

        _torch_module = torch
        TORCH_AVAILABLE = True
    except Exception:
        _torch_module = None
        TORCH_AVAILABLE = False

    return _torch_module


def _ml_services_enabled() -> bool:
    flag = os.getenv("BIAS_DETECTION_DISABLE_LOCAL_ML_SERVICES", "").lower().strip()
    return flag not in {"1", "true", "yes", "on"}

from bias_detection.config import settings
from bias_detection.models import BiasType, ConfidenceLevel

logger = structlog.get_logger(__name__)


class ModelService(ABC):
    """Abstract base class for model services"""

    def __init__(self, model_path: str, model_name: str):
        self.model_path = Path(model_path)
        self.model_name = model_name
        self.model = None
        self.tokenizer = None
        self.is_loaded = False
        self.load_time = 0.0

    @abstractmethod
    async def load_model(self) -> bool:
        """Load the model into memory"""

    @abstractmethod
    async def predict(self, text: str) -> dict[str, Any]:
        """Make a prediction"""

    @abstractmethod
    def get_model_info(self) -> dict[str, Any]:
        """Get model information"""

    async def ensure_model_loaded(self) -> None:
        """Ensure model is loaded, load if necessary"""
        if not self.is_loaded:
            await self.load_model()

    def _get_text_hash(self, text: str) -> str:
        """Get hash of text for caching"""
        return hashlib.sha256(text.encode()).hexdigest()


class TensorFlowModelService(ModelService):
    """TensorFlow model service for bias detection"""

    def __init__(self, model_path: str | None = None):
        self._tf = _load_tensorflow()
        if self._tf is None:
            raise ImportError(
                "TensorFlow is not available. Install it with: pip install tensorflow"
            )
        super().__init__(
            model_path or settings.tensorflow_model_path, "tensorflow_bias_detector"
        )
        self.max_length = settings.max_sequence_length
        self.batch_size = settings.batch_size

    async def load_model(self) -> bool:
        """Load TensorFlow model"""
        try:
            logger.info(f"Loading TensorFlow model from {self.model_path}")
            start_time = time.time()

            tf = self._tf
            # Check if model exists
            if not self.model_path.exists():
                logger.warning(f"Model path {self.model_path} does not exist")
                await self._download_pretrained_model()

            # Load model — tf is guaranteed non-None here (constructor raises if TF unavailable)
            assert tf is not None, "TensorFlow must be available"
            self.model = tf.keras.models.load_model(str(self.model_path))

            # Load tokenizer
            tokenizer_path = self.model_path / "tokenizer"
            if tokenizer_path.exists():
                _load_transformers()
                if AutoTokenizer is not None:
                    # For BERT-based models
                    self.tokenizer = AutoTokenizer.from_pretrained(str(tokenizer_path))
                else:
                    self.tokenizer = self._create_basic_tokenizer()
            else:
                # For custom models, create basic tokenizer
                self.tokenizer = self._create_basic_tokenizer()

            self.is_loaded = True
            self.load_time = time.time() - start_time

            logger.info(
                f"TensorFlow model loaded successfully in {self.load_time:.2f}s",
                model_path=str(self.model_path),
                model_name=self.model_name,
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to load TensorFlow model: {str(e)!s}",
                model_path=str(self.model_path),
                error=str(e),
            )
            return False

    async def _download_pretrained_model(self) -> None:
        """Download pretrained model if not available locally"""
        logger.info("Downloading pretrained TensorFlow bias detection model")

        # Create model directory
        self.model_path.mkdir(parents=True, exist_ok=True)

        # Download and save a basic bias detection model
        # This is a placeholder - in production, you would download a real model
        model = self._create_basic_model()

        # Save model
        model.save(str(self.model_path))

        # Save tokenizer
        _load_transformers()
        if AutoTokenizer is not None:
            tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
            tokenizer.save_pretrained(str(self.model_path / "tokenizer"))
        else:
            logger.warning(
                "AutoTokenizer unavailable; skipping tokenizer persistence for TensorFlow model."
            )

        logger.info("Pretrained model downloaded and saved")

    def _create_basic_model(self) -> Any:
        """Create a basic bias detection model"""
        _load_transformers()
        if TFBertForSequenceClassification is None:
            raise ImportError(
                "TFBertForSequenceClassification is not available in the installed "
                "transformers version."
            )
        return TFBertForSequenceClassification.from_pretrained(
            "bert-base-uncased", num_labels=len(BiasType.__members__)
        )

    def _create_basic_tokenizer(self) -> Any:
        """Create basic tokenizer"""

        # Simple tokenizer that splits on whitespace
        class BasicTokenizer:
            def __init__(self):
                self.vocab = {}
                self.word_index = 1

            def encode_plus(
                self, text: str, max_length: int = 512, **_kwargs
            ) -> dict[str, Any]:
                words = text.lower().split()
                tokens = []
                for word in words:
                    if word not in self.vocab:
                        self.vocab[word] = self.word_index
                        self.word_index += 1
                    tokens.append(self.vocab[word])

                # Pad or truncate
                if len(tokens) > max_length:
                    tokens = tokens[:max_length]
                else:
                    tokens.extend([0] * (max_length - len(tokens)))

                return {
                    "input_ids": tokens,
                    "attention_mask": [1 if t != 0 else 0 for t in tokens],
                }

        return BasicTokenizer()

    async def predict(self, text: str) -> dict[str, Any]:
        """Make prediction using TensorFlow model"""
        await self.ensure_model_loaded()

        try:
            start_time = time.time()

            # Tokenize input
            if hasattr(self.tokenizer, "encode_plus"):
                encoded = self.tokenizer.encode_plus(
                    text,
                    max_length=self.max_length,
                    padding="max_length",
                    truncation=True,
                    return_tensors="tf",
                )
            else:
                encoded = self.tokenizer.encode_plus(text, max_length=self.max_length)

            # Make prediction
            tf = self._tf
            if isinstance(encoded, dict) and "input_ids" in encoded:
                # BERT-style input
                predictions = self.model(encoded)
                logits = getattr(predictions, "logits", predictions)
                probabilities = tf.nn.softmax(logits, axis=-1)
            else:
                # Custom model input
                input_ids = np.array([encoded["input_ids"]])
                probabilities = self.model.predict(input_ids)

            # Process results
            results = self._process_predictions(probabilities, text)

            processing_time = time.time() - start_time

            logger.info(
                f"TensorFlow prediction completed in {processing_time:.3f}s",
                text_length=len(text),
                results_count=len(results),
            )

            return {
                "model_name": self.model_name,
                "framework": "tensorflow",
                "processing_time_ms": int(processing_time * 1000),
                "results": results,
                "text_hash": self._get_text_hash(text),
            }

        except Exception as e:
            logger.error(
                f"TensorFlow prediction failed: {str(e)!s}",
                text_length=len(text),
                error=str(e),
            )
            raise

    def _process_predictions(
        self, probabilities: Any, text: str
    ) -> list[dict[str, Any]]:
        """Process model predictions into bias scores"""
        # Convert to numpy
        probs = (
            probabilities.numpy() if hasattr(probabilities, "numpy") else probabilities
        )

        # Handle different output shapes
        if len(probs.shape) == 2:
            probs = probs[0]  # Take first batch item

        results = []
        bias_types = list(BiasType.__members__.values())

        for i, prob in enumerate(probs):
            if i < len(bias_types):
                bias_type = bias_types[i]
                confidence = float(prob)

                # Determine confidence level
                if confidence >= 0.8:
                    confidence_level = ConfidenceLevel.VERY_HIGH
                elif confidence >= 0.6:
                    confidence_level = ConfidenceLevel.HIGH
                elif confidence >= 0.4:
                    confidence_level = ConfidenceLevel.MEDIUM
                else:
                    confidence_level = ConfidenceLevel.LOW

                # Extract evidence (simplified)
                evidence = self._extract_evidence(text, bias_type)

                results.append(
                    {
                        "bias_type": bias_type,
                        "score": confidence,
                        "confidence": confidence,
                        "confidence_level": confidence_level,
                        "evidence": evidence,
                        "explanation": f"Detected {bias_type.value} bias with {confidence_level.value} confidence",
                    }
                )

        return results

    def _extract_evidence(self, text: str, bias_type: BiasType) -> list[str]:
        """Extract evidence snippets for bias detection"""
        # Simplified evidence extraction
        # In production, this would use more sophisticated NLP techniques
        words = text.lower().split()
        evidence = []

        # Example bias keywords (simplified)
        bias_keywords = {
            BiasType.GENDER: ["he", "she", "man", "woman", "male", "female"],
            BiasType.RACIAL: ["black", "white", "asian", "hispanic"],
            BiasType.AGE: ["young", "old", "elderly", "youth"],
        }

        keywords = bias_keywords.get(bias_type, [])
        for word in words:
            if word in keywords:
                evidence.append(word)

        return evidence[:3]  # Limit to top 3 evidence pieces

    def get_model_info(self) -> dict[str, Any]:
        """Get TensorFlow model information"""
        return {
            "name": self.model_name,
            "framework": "tensorflow",
            "version": self._tf.__version__ if self._tf is not None else "unavailable",
            "loaded": self.is_loaded,
            "load_time_ms": int(self.load_time * 1000),
            "model_path": str(self.model_path),
            "max_sequence_length": self.max_length,
            "batch_size": self.batch_size,
        }


class PyTorchModelService(ModelService):
    """PyTorch model service for bias detection"""

    def __init__(self, model_path: str | None = None):
        self._torch = _load_torch()
        if self._torch is None:
            raise ImportError(
                "PyTorch is not available. Install a working PyTorch build or disable "
                "PyTorch-backed inference."
            )
        _load_transformers()
        if not _transformer_available():
            raise ImportError(
                "transformers is not available. Install a working transformers build or "
                "disable PyTorch-backed inference."
            )
        super().__init__(
            model_path or settings.pytorch_model_path, "pytorch_bias_detector"
        )
        self.max_length = settings.max_sequence_length
        self.batch_size = settings.batch_size
        torch = self._torch
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    async def load_model(self) -> bool:
        """Load PyTorch model"""
        try:
            logger.info(f"Loading PyTorch model from {self.model_path}")
            start_time = time.time()

            # Check if model exists
            if not self.model_path.exists():
                logger.warning(f"Model path {self.model_path} does not exist")
                await self._download_pretrained_model()

            # Load model
            model_file = self.model_path / "model.pt"
            torch = self._torch
            if model_file.exists():
                self.model = torch.load(model_file, map_location=self.device)
            else:
                # Create basic model if not found
                self.model = self._create_basic_model()

            # Load tokenizer
            tokenizer_path = self.model_path / "tokenizer"
            if tokenizer_path.exists():
                _load_transformers()
                if AutoTokenizer is not None:
                    self.tokenizer = AutoTokenizer.from_pretrained(str(tokenizer_path))
                else:
                    self.tokenizer = self._create_basic_tokenizer()
            else:
                _load_transformers()
                if AutoTokenizer is not None:
                    self.tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
                else:
                    self.tokenizer = self._create_basic_tokenizer()

            self.model.to(self.device)
            self.model.eval()

            self.is_loaded = True
            self.load_time = time.time() - start_time

            logger.info(
                f"PyTorch model loaded successfully in {self.load_time:.2f}s",
                model_path=str(self.model_path),
                model_name=self.model_name,
                device=str(self.device),
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to load PyTorch model: {str(e)!s}",
                model_path=str(self.model_path),
                error=str(e),
            )
            return False

    async def _download_pretrained_model(self) -> None:
        """Download pretrained model if not available locally"""
        logger.info("Downloading pretrained PyTorch bias detection model")

        # Create model directory
        self.model_path.mkdir(parents=True, exist_ok=True)

        # Create and save a basic bias detection model
        model = self._create_basic_model()

        # Save model
        torch = self._torch
        torch.save(model, str(self.model_path / "model.pt"))

        # Save tokenizer
        _load_transformers()
        if AutoTokenizer is not None:
            tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
            tokenizer.save_pretrained(str(self.model_path / "tokenizer"))
        else:
            logger.warning(
                "AutoTokenizer unavailable; skipping tokenizer persistence for PyTorch model."
            )

        logger.info("Pretrained model downloaded and saved")

    def _create_basic_model(self) -> torch.nn.Module:
        """Create a basic bias detection model"""
        # Simple BERT-based model for bias detection using top-level BertModel

        torch = self._torch
        _load_transformers()
        if BertModel is None:
            raise ImportError(
                "transformers BertModel is not available for PyTorch model creation."
            )

        class BiasDetectionModel(torch.nn.Module):
            def __init__(self, num_labels: int = len(BiasType.__members__)):
                super().__init__()
                self.bert = BertModel.from_pretrained("bert-base-uncased")
                self.classifier = torch.nn.Linear(
                    self.bert.config.hidden_size, num_labels
                )
                self.dropout = torch.nn.Dropout(0.1)

            def forward(self, input_ids, attention_mask):
                outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)
                pooled_output = outputs.pooler_output
                pooled_output = self.dropout(pooled_output)
                return self.classifier(pooled_output)

        return BiasDetectionModel()

    async def predict(self, text: str) -> dict[str, Any]:
        """Make prediction using PyTorch model"""
        await self.ensure_model_loaded()

        try:
            start_time = time.time()

            # Tokenize input
            encoded = self.tokenizer.encode_plus(
                text,
                max_length=self.max_length,
                padding="max_length",
                truncation=True,
                return_tensors="pt",
            )

            # Move to device
            input_ids = encoded["input_ids"].to(self.device)
            attention_mask = encoded["attention_mask"].to(self.device)

            # Make prediction
            torch = self._torch
            with torch.no_grad():
                outputs = self.model(input_ids, attention_mask)
                probabilities = torch.nn.functional.softmax(outputs, dim=-1)

            # Process results
            results = self._process_predictions(probabilities, text)

            processing_time = time.time() - start_time

            logger.info(
                f"PyTorch prediction completed in {processing_time:.3f}s",
                text_length=len(text),
                results_count=len(results),
                device=str(self.device),
            )

            return {
                "model_name": self.model_name,
                "framework": "pytorch",
                "processing_time_ms": int(processing_time * 1000),
                "results": results,
                "text_hash": self._get_text_hash(text),
                "device": str(self.device),
            }

        except Exception as e:
            logger.error(
                f"PyTorch prediction failed: {str(e)!s}",
                text_length=len(text),
                error=str(e),
            )
            raise

    def _process_predictions(
        self, probabilities: torch.Tensor, text: str
    ) -> list[dict[str, Any]]:
        """Process model predictions into bias scores"""
        # Convert to numpy
        probs = probabilities.cpu().numpy()

        # Handle different output shapes
        if len(probs.shape) == 2:
            probs = probs[0]  # Take first batch item

        results = []
        bias_types = list(BiasType.__members__.values())

        for i, prob in enumerate(probs):
            if i < len(bias_types):
                bias_type = bias_types[i]
                confidence = float(prob)

                # Determine confidence level
                if confidence >= 0.8:
                    confidence_level = ConfidenceLevel.VERY_HIGH
                elif confidence >= 0.6:
                    confidence_level = ConfidenceLevel.HIGH
                elif confidence >= 0.4:
                    confidence_level = ConfidenceLevel.MEDIUM
                else:
                    confidence_level = ConfidenceLevel.LOW

                # Extract evidence (simplified)
                evidence = self._extract_evidence(text, bias_type)

                results.append(
                    {
                        "bias_type": bias_type,
                        "score": confidence,
                        "confidence": confidence,
                        "confidence_level": confidence_level,
                        "evidence": evidence,
                        "explanation": f"Detected {bias_type.value} bias with {confidence_level.value} confidence",
                    }
                )

        return results

    def _extract_evidence(self, text: str, bias_type: BiasType) -> list[str]:
        """Extract evidence snippets for bias detection"""
        # Similar to TensorFlow implementation
        words = text.lower().split()
        evidence = []

        bias_keywords = {
            BiasType.GENDER: ["he", "she", "man", "woman", "male", "female"],
            BiasType.RACIAL: ["black", "white", "asian", "hispanic"],
            BiasType.AGE: ["young", "old", "elderly", "youth"],
        }

        keywords = bias_keywords.get(bias_type, [])
        for word in words:
            if word in keywords:
                evidence.append(word)

        return evidence[:3]

    def get_model_info(self) -> dict[str, Any]:
        """Get PyTorch model information"""
        torch = self._torch
        return {
            "name": self.model_name,
            "framework": "pytorch",
            "version": torch.__version__ if torch is not None else "unavailable",
            "loaded": self.is_loaded,
            "load_time_ms": int(self.load_time * 1000),
            "model_path": str(self.model_path),
            "device": str(self.device),
            "max_sequence_length": self.max_length,
            "batch_size": self.batch_size,
        }


class ModelEnsembleService:
    """Ensemble service combining multiple models"""

    def __init__(self):
        self.services = []
        if not _ml_services_enabled():
            logger.info("Skipping local ML model services due test-time configuration.")
            self.tf_service = None
            self.pt_service = None
            self.nvidia_service = None
            return

        # Only add TensorFlow service if available
        if _load_tensorflow() is not None:
            try:
                self.tf_service = TensorFlowModelService()
                self.services.append(self.tf_service)
            except Exception as e:
                logger.warning(f"TensorFlow service not available: {e}")
                self.tf_service = None
        else:
            self.tf_service = None

        # PyTorch service (optional)
        self.pt_service = None
        if _load_torch() is not None:
            if _transformer_available():
                try:
                    self.pt_service = PyTorchModelService()
                    self.services.append(self.pt_service)
                except Exception as e:
                    logger.debug(f"PyTorch service not available: {e}")
            else:
                logger.info(
                    "PyTorch service skipped because transformers is not available."
                )
                self.pt_service = None
        else:
            self.pt_service = None

        # NVIDIA API service for Kimi-k2.5 (optional)
        try:
            from bias_detection.services.nvidia_api_service import NvidiaAPIService

            self.nvidia_service = NvidiaAPIService()
            # Note: We don't add this to services list automatically as it's a different type of service
        except ImportError as e:
            logger.warning(f"NVIDIA API service not available: {e}")
            self.nvidia_service = None
        except Exception as e:
            logger.warning(f"Error initializing NVIDIA API service: {e}")
            self.nvidia_service = None

    async def load_all_models(self) -> bool:
        """Load all models"""
        results = []
        if not self.services:
            logger.warning("No model services are configured.")
            return False
        for service in self.services:
            result = await service.load_model()
            results.append(result)
        return all(results)

    async def predict_ensemble(self, text: str) -> dict[str, Any]:
        """Make ensemble prediction using multiple models"""
        await self.load_all_models()

        results = []
        for service in self.services:
            try:
                result = await service.predict(text)
                results.append(result)
            except Exception as e:
                logger.warning(
                    f"Model {service.model_name} failed: {str(e)!s}", error=str(e)
                )

        if not results:
            raise RuntimeError("All models failed to predict")

        # Combine results (simple averaging for now)
        combined_results = self._combine_results(results)

        # Use first available service for text hash
        hash_service = self.tf_service or self.pt_service
        if hash_service is None:
            raise RuntimeError("No model service is available for predictions.")
        return {
            "ensemble_results": combined_results,
            "individual_results": results,
            "models_used": len(results),
            "text_hash": hash_service._get_text_hash(text),
        }

    def _combine_results(self, results: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Combine results from multiple models"""
        # Group results by bias type
        bias_groups = {}

        for result in results:
            for bias_result in result["results"]:
                bias_type = bias_result["bias_type"]
                if bias_type not in bias_groups:
                    bias_groups[bias_type] = []
                bias_groups[bias_type].append(bias_result)

        # Average scores for each bias type
        combined_results = []
        for bias_type, results_list in bias_groups.items():
            avg_score = sum(r["score"] for r in results_list) / len(results_list)
            avg_confidence = sum(r["confidence"] for r in results_list) / len(
                results_list
            )

            # Use highest confidence level
            confidence_levels = [r["confidence_level"] for r in results_list]
            highest_confidence = max(
                confidence_levels, key=self._confidence_level_value
            )

            # Combine evidence
            all_evidence = []
            for r in results_list:
                all_evidence.extend(r["evidence"])

            combined_results.append(
                {
                    "bias_type": bias_type,
                    "score": avg_score,
                    "confidence": avg_confidence,
                    "confidence_level": highest_confidence,
                    "evidence": list(set(all_evidence))[:5],  # Unique evidence, max 5
                    "explanation": f"Ensemble detection: {bias_type.value} bias with {highest_confidence.value} confidence",
                }
            )

        return combined_results

    def _confidence_level_value(self, level: ConfidenceLevel) -> int:
        """Get numeric value for confidence level"""
        values = {
            ConfidenceLevel.LOW: 1,
            ConfidenceLevel.MEDIUM: 2,
            ConfidenceLevel.HIGH: 3,
            ConfidenceLevel.VERY_HIGH: 4,
        }
        return values.get(level, 0)

    def get_ensemble_info(self) -> dict[str, Any]:
        """Get ensemble service information"""
        info = {"ensemble_service": True, "models": []}

        for service in self.services:
            info["models"].append(service.get_model_info())

        return info
