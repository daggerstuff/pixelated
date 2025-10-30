"""
Model serving adapters for Pixelated Empathy AI project.
Provides unified interfaces for different model formats (PyTorch, TensorFlow, ONNX, LLMs).
"""

import os
import json
import logging
import time
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Union, List, Tuple
from pathlib import Path
from dataclasses import dataclass
import torch
import numpy as np

# Import transformers for PyTorch models
try:
    from transformers import (
        AutoModel, AutoTokenizer, AutoModelForCausalLM,
        PreTrainedModel, PreTrainedTokenizer
    )
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    AutoModel = None
    AutoTokenizer = None
    AutoModelForCausalLM = None
    PreTrainedModel = object
    PreTrainedTokenizer = object

# Import ONNX Runtime
try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False
    ort = None

# Import TensorFlow
try:
    import tensorflow as tf
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    tf = None

logger = logging.getLogger(__name__)


@dataclass
class ModelConfig:
    """Configuration for model loading and serving"""
    model_path: str
    model_type: str  # 'pytorch', 'tensorflow', 'onnx', 'llm'
    model_name: str
    model_version: str
    max_batch_size: int = 1
    max_seq_length: int = 512
    device: str = "cpu"
    precision: str = "fp32"  # fp32, fp16, bf16
    num_threads: int = 0  # 0 means use system default
    cache_size: int = 1024  # Cache size for inference
    metadata: Optional[Dict[str, Any]] = None


class BaseModelAdapter(ABC):
    """Abstract base class for model adapters"""
    
    def __init__(self, config: ModelConfig):
        self.config = config
        self.model = None
        self.tokenizer = None
        self.is_loaded = False
        self.load_time = 0.0
        self.inference_count = 0
        self.total_inference_time = 0.0
    
    @abstractmethod
    def load_model(self):
        """Load the model from the specified path"""
        pass
    
    @abstractmethod
    def predict(self, inputs: Union[Dict[str, Any], List[Any]]) -> Any:
        """Perform inference on the inputs"""
        pass
    
    @abstractmethod
    def predict_batch(self, inputs: List[Union[Dict[str, Any], List[Any]]]) -> List[Any]:
        """Perform batch inference"""
        pass
    
    @abstractmethod
    def unload_model(self):
        """Unload the model from memory"""
        pass
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the loaded model"""
        return {
            "model_name": self.config.model_name,
            "model_version": self.config.model_version,
            "model_type": self.config.model_type,
            "loaded": self.is_loaded,
            "load_time": self.load_time,
            "inference_count": self.inference_count,
            "avg_inference_time": self.total_inference_time / self.inference_count if self.inference_count > 0 else 0.0,
            "device": self.config.device
        }
    
    def warmup(self, sample_input: Union[Dict[str, Any], List[Any]]) -> bool:
        """Warm up the model with a sample input"""
        try:
            _ = self.predict(sample_input)
            return True
        except Exception as e:
            logger.error(f"Model warmup failed: {e}")
            return False


class PyTorchModelAdapter(BaseModelAdapter):
    """Adapter for PyTorch models"""
    
    def __init__(self, config: ModelConfig):
        super().__init__(config)
        if not TRANSFORMERS_AVAILABLE:
            raise ImportError("transformers library is required for PyTorch models")
    
    def load_model(self):
        """Load PyTorch model from path"""
        start_time = time.time()
        
        # Determine torch dtype based on precision
        dtype_map = {
            "fp32": torch.float32,
            "fp16": torch.float16,
            "bf16": torch.bfloat16
        }
        torch_dtype = dtype_map.get(self.config.precision, torch.float32)
        
        try:
            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(self.config.model_path)
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
            
            # Load model
            if self.config.device.startswith("cuda"):
                self.model = AutoModelForCausalLM.from_pretrained(
                    self.config.model_path,
                    torch_dtype=torch_dtype,
                    device_map="auto",
                    low_cpu_mem_usage=True
                )
            else:
                self.model = AutoModelForCausalLM.from_pretrained(
                    self.config.model_path,
                    torch_dtype=torch_dtype,
                    low_cpu_mem_usage=True
                )
                if self.config.device == "cpu" and self.config.num_threads > 0:
                    torch.set_num_threads(self.config.num_threads)
            
            self.is_loaded = True
            self.load_time = time.time() - start_time
            logger.info(f"PyTorch model loaded successfully in {self.load_time:.2f}s")
            
        except Exception as e:
            logger.error(f"Failed to load PyTorch model: {e}")
            raise
    
    def predict(self, inputs: Union[Dict[str, Any], List[Any]]) -> Any:
        """Perform single inference"""
        if not self.is_loaded:
            raise RuntimeError("Model not loaded")
        
        start_time = time.time()
        
        try:
            if isinstance(inputs, str):
                # Tokenize string input
                inputs = self.tokenizer(
                    inputs,
                    return_tensors="pt",
                    padding=True,
                    truncation=True,
                    max_length=self.config.max_seq_length
                )
                inputs = {k: v.to(self.model.device) for k, v in inputs.items()}
                
                with torch.no_grad():
                    outputs = self.model.generate(
                        **inputs,
                        max_length=min(inputs['input_ids'].shape[1] + 100, self.config.max_seq_length),
                        temperature=0.7,
                        do_sample=True,
                        pad_token_id=self.tokenizer.eos_token_id
                    )
                
                # Decode output
                result = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
                
            elif isinstance(inputs, dict):
                # Process tokenized inputs
                inputs = {k: v.to(self.model.device) if torch.is_tensor(v) else v for k, v in inputs.items()}
                
                with torch.no_grad():
                    outputs = self.model(**inputs)
                
                result = outputs.logits.cpu().numpy() if hasattr(outputs, 'logits') else outputs
    
            self.inference_count += 1
            self.total_inference_time += time.time() - start_time
            return result
            
        except Exception as e:
            logger.error(f"PyTorch inference failed: {e}")
            raise
    
    def predict_batch(self, inputs: List[Union[Dict[str, Any], List[Any]]]) -> List[Any]:
        """Perform batch inference"""
        if not self.is_loaded:
            raise RuntimeError("Model not loaded")
        
        if len(inputs) > self.config.max_batch_size:
            raise ValueError(f"Batch size {len(inputs)} exceeds maximum {self.config.max_batch_size}")
        
        results = []
        for inp in inputs:
            results.append(self.predict(inp))
        
        return results
    
    def unload_model(self):
        """Unload PyTorch model from memory"""
        if self.model is not None:
            del self.model
            self.model = None
        if self.tokenizer is not None:
            del self.tokenizer
            self.tokenizer = None
        torch.cuda.empty_cache() if torch.cuda.is_available() else None
        self.is_loaded = False
        logger.info("PyTorch model unloaded")


class TensorFlowModelAdapter(BaseModelAdapter):
    """Adapter for TensorFlow models"""
    
    def __init__(self, config: ModelConfig):
        super().__init__(config)
        if not TF_AVAILABLE:
            raise ImportError("tensorflow library is required for TensorFlow models")
    
    def load_model(self):
        """Load TensorFlow model from path"""
        start_time = time.time()
        
        try:
            self.model = tf.saved_model.load(self.config.model_path)
            self.is_loaded = True
            self.load_time = time.time() - start_time
            logger.info(f"TensorFlow model loaded successfully in {self.load_time:.2f}s")
            
        except Exception as e:
            logger.error(f"Failed to load TensorFlow model: {e}")
            raise
    
    def predict(self, inputs: Union[Dict[str, Any], List[Any]]) -> Any:
        """Perform single inference"""
        if not self.is_loaded:
            raise RuntimeError("Model not loaded")
        
        start_time = time.time()
        
        try:
            # TensorFlow model prediction
            # Convert inputs to TF tensors if needed
            if isinstance(inputs, dict):
                tf_inputs = {k: tf.constant(v) if not tf.is_tensor(v) else v for k, v in inputs.items()}
            else:
                tf_inputs = tf.constant(inputs)
            
            results = self.model(tf_inputs)
            
            self.inference_count += 1
            self.total_inference_time += time.time() - start_time
            return results
            
        except Exception as e:
            logger.error(f"TensorFlow inference failed: {e}")
            raise
    
    def predict_batch(self, inputs: List[Union[Dict[str, Any], List[Any]]]) -> List[Any]:
        """Perform batch inference"""
        if not self.is_loaded:
            raise RuntimeError("Model not loaded")
        
        if len(inputs) > self.config.max_batch_size:
            raise ValueError(f"Batch size {len(inputs)} exceeds maximum {self.config.max_batch_size}")
        
        # Stack inputs for batch processing
        if isinstance(inputs[0], dict):
            batched_inputs = {}
            for key in inputs[0].keys():
                batched_inputs[key] = tf.stack([inp[key] for inp in inputs])
            return self.predict(batched_inputs)
        else:
            batched_inputs = tf.stack(inputs)
            return self.predict(batched_inputs)
    
    def unload_model(self):
        """Unload TensorFlow model from memory"""
        if self.model is not None:
            del self.model
            self.model = None
        self.is_loaded = False
        logger.info("TensorFlow model unloaded")


class ONNXModelAdapter(BaseModelAdapter):
    """Adapter for ONNX models"""
    
    def __init__(self, config: ModelConfig):
        super().__init__(config)
        if not ONNX_AVAILABLE:
            raise ImportError("onnxruntime library is required for ONNX models")
    
    def load_model(self):
        """Load ONNX model from path"""
        start_time = time.time()
        
        # Configure ONNX session options
        session_options = ort.SessionOptions()
        if self.config.num_threads > 0:
            session_options.intra_op_num_threads = self.config.num_threads
        session_options.inter_op_num_threads = 0  # Use system default
        session_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        
        if self.config.device == "cpu":
            providers = ['CPUExecutionProvider']
        elif self.config.device.startswith("cuda"):
            providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
        else:
            providers = ['CPUExecutionProvider']
        
        try:
            self.model = ort.InferenceSession(
                self.config.model_path,
                sess_options=session_options,
                providers=providers
            )
            self.is_loaded = True
            self.load_time = time.time() - start_time
            logger.info(f"ONNX model loaded successfully in {self.load_time:.2f}s")
            
        except Exception as e:
            logger.error(f"Failed to load ONNX model: {e}")
            raise
    
    def predict(self, inputs: Union[Dict[str, Any], List[Any]]) -> Any:
        """Perform single inference"""
        if not self.is_loaded:
            raise RuntimeError("Model not loaded")
        
        start_time = time.time()
        
        try:
            if isinstance(inputs, dict):
                # ONNX expects numpy arrays
                np_inputs = {k: np.array(v) if not isinstance(v, np.ndarray) else v for k, v in inputs.items()}
                results = self.model.run(None, np_inputs)
            else:
                # Assume single input array
                np_input = np.array(inputs) if not isinstance(inputs, np.ndarray) else inputs
                # Get input name from the model
                input_name = self.model.get_inputs()[0].name
                results = self.model.run(None, {input_name: np_input})
            
            self.inference_count += 1
            self.total_inference_time += time.time() - start_time
            return results[0] if len(results) == 1 else results
            
        except Exception as e:
            logger.error(f"ONNX inference failed: {e}")
            raise
    
    def predict_batch(self, inputs: List[Union[Dict[str, Any], List[Any]]]) -> List[Any]:
        """Perform batch inference"""
        if not self.is_loaded:
            raise RuntimeError("Model not loaded")
        
        if len(inputs) > self.config.max_batch_size:
            raise ValueError(f"Batch size {len(inputs)} exceeds maximum {self.config.max_batch_size}")
        
        # Stack inputs for batch processing
        if isinstance(inputs[0], dict):
            batched_inputs = {}
            for key in inputs[0].keys():
                batched_inputs[key] = np.stack([inp[key] for inp in inputs])
            return self.predict(batched_inputs)
        else:
            batched_inputs = np.stack(inputs)
            return self.predict(batched_inputs)
    
    def unload_model(self):
        """Unload ONNX model - ONNX Runtime handles cleanup automatically"""
        if self.model is not None:
            del self.model
            self.model = None
        self.is_loaded = False
        logger.info("ONNX model unloaded")


class LLMModelAdapter(BaseModelAdapter):
    """Adapter for Large Language Models (API-based)"""
    
    def __init__(self, config: ModelConfig):
        super().__init__(config)
        # For API-based models, we might need additional config like API keys
        self.api_key = os.getenv("LLM_API_KEY")
        self.api_base = os.getenv("LLM_API_BASE", "https://api.openai.com/v1")
    
    def load_model(self):
        """Validate LLM configuration (no actual model loading for API-based models)"""
        start_time = time.time()
        
        # For API-based models, "loading" is just validating the configuration
        if not self.api_key:
            raise ValueError("LLM_API_KEY environment variable is required")
        
        self.is_loaded = True
        self.load_time = time.time() - start_time
        logger.info(f"LLM adapter configured in {self.load_time:.2f}s")
    
    def predict(self, inputs: Union[Dict[str, Any], List[Any]]) -> Any:
        """Perform single inference using LLM API"""
        if not self.is_loaded:
            raise RuntimeError("Model not loaded")
        
        start_time = time.time()
        
        try:
            import requests
            
            # Prepare the request
            if isinstance(inputs, str):
                messages = [{"role": "user", "content": inputs}]
            elif isinstance(inputs, dict) and "messages" in inputs:
                messages = inputs["messages"]
            else:
                messages = [{"role": "user", "content": str(inputs)}]
            
            payload = {
                "model": self.config.model_name,
                "messages": messages,
                "max_tokens": 256,
                "temperature": 0.7
            }
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                f"{self.api_base}/chat/completions",
                json=payload,
                headers=headers,
                timeout=60
            )
            
            response.raise_for_status()
            result = response.json()
            
            self.inference_count += 1
            self.total_inference_time += time.time() - start_time
            return result["choices"][0]["message"]["content"]
            
        except Exception as e:
            logger.error(f"LLM inference failed: {e}")
            raise
    
    def predict_batch(self, inputs: List[Union[Dict[str, Any], List[Any]]]) -> List[Any]:
        """Perform batch inference - for API models, process sequentially"""
        if not self.is_loaded:
            raise RuntimeError("Model not loaded")
        
        if len(inputs) > self.config.max_batch_size:
            raise ValueError(f"Batch size {len(inputs)} exceeds maximum {self.config.max_batch_size}")
        
        results = []
        for inp in inputs:
            results.append(self.predict(inp))
        
        return results
    
    def unload_model(self):
        """LLM adapter doesn't hold model in memory"""
        self.is_loaded = False
        logger.info("LLM adapter unloaded")


class ModelAdapterManager:
    """Manager for multiple model adapters with loading/unloading capabilities"""
    
    def __init__(self):
        self.adapters: Dict[str, BaseModelAdapter] = {}
        self.active_model: Optional[str] = None
        self.logger = logging.getLogger(__name__)
    
    def register_adapter(self, name: str, adapter: BaseModelAdapter):
        """Register a model adapter"""
        self.adapters[name] = adapter
        self.logger.info(f"Registered model adapter: {name}")
    
    def load_model(self, name: str, config: ModelConfig) -> BaseModelAdapter:
        """Load a model by name with specified configuration"""
        if name in self.adapters:
            # Unload existing model if different
            if self.active_model and self.active_model != name:
                self.unload_model(self.active_model)
        
        # Create new adapter based on model type
        adapter_class = self._get_adapter_class(config.model_type)
        adapter = adapter_class(config)
        
        # Load the model
        adapter.load_model()
        
        # Register the adapter
        self.adapters[name] = adapter
        self.active_model = name
        
        self.logger.info(f"Loaded model {name} ({config.model_type})")
        return adapter
    
    def _get_adapter_class(self, model_type: str) -> type:
        """Get the appropriate adapter class based on model type"""
        adapter_map = {
            "pytorch": PyTorchModelAdapter,
            "torch": PyTorchModelAdapter,
            "tensorflow": TensorFlowModelAdapter,
            "tf": TensorFlowModelAdapter,
            "onnx": ONNXModelAdapter,
            "llm": LLMModelAdapter,
            "openai": LLMModelAdapter
        }
        
        if model_type not in adapter_map:
            raise ValueError(f"Unsupported model type: {model_type}")
        
        return adapter_map[model_type]
    
    def get_adapter(self, name: str) -> Optional[BaseModelAdapter]:
        """Get a model adapter by name"""
        return self.adapters.get(name)
    
    def predict(self, name: str, inputs: Union[Dict[str, Any], List[Any]]) -> Any:
        """Perform prediction using a specific model"""
        adapter = self.get_adapter(name)
        if not adapter:
            raise ValueError(f"Model adapter {name} not found")
        
        return adapter.predict(inputs)
    
    def predict_batch(self, name: str, inputs: List[Union[Dict[str, Any], List[Any]]]) -> List[Any]:
        """Perform batch prediction using a specific model"""
        adapter = self.get_adapter(name)
        if not adapter:
            raise ValueError(f"Model adapter {name} not found")
        
        return adapter.predict_batch(inputs)
    
    def unload_model(self, name: str):
        """Unload a specific model"""
        if name in self.adapters:
            self.adapters[name].unload_model()
            del self.adapters[name]
            if self.active_model == name:
                self.active_model = None
            self.logger.info(f"Unloaded model: {name}")
    
    def unload_all_models(self):
        """Unload all loaded models"""
        for name in list(self.adapters.keys()):
            self.unload_model(name)
    
    def get_model_info(self, name: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific model"""
        adapter = self.get_adapter(name)
        if adapter:
            return adapter.get_model_info()
        return None
    
    def list_models(self) -> List[str]:
        """List all registered models"""
        return list(self.adapters.keys())


def create_model_adapter(model_path: str, model_type: str, model_name: str, **kwargs) -> BaseModelAdapter:
    """Factory function to create model adapters"""
    config = ModelConfig(
        model_path=model_path,
        model_type=model_type,
        model_name=model_name,
        model_version=kwargs.get("model_version", "1.0.0"),
        max_batch_size=kwargs.get("max_batch_size", 1),
        max_seq_length=kwargs.get("max_seq_length", 512),
        device=kwargs.get("device", "cpu"),
        precision=kwargs.get("precision", "fp32"),
        num_threads=kwargs.get("num_threads", 0),
        cache_size=kwargs.get("cache_size", 1024),
        metadata=kwargs.get("metadata", {})
    )
    
    # Get appropriate adapter class
    adapter_class = ModelAdapterManager()._get_adapter_class(model_type)
    adapter = adapter_class(config)
    adapter.load_model()
    
    return adapter


def test_model_adapters():
    """Test function to verify model adapter functionality"""
    logger.info("Testing model adapters...")
    
    manager = ModelAdapterManager()
    
    # Test different model types (with mock paths for demonstration)
    test_configs = [
        {
            "name": "test_pytorch",
            "config": ModelConfig(
                model_path="microsoft/DialoGPT-medium",  # Example model
                model_type="pytorch",
                model_name="dialogpt_test",
                model_version="1.0.0",
                device="cpu",
                precision="fp32"
            )
        }
    ]
    
    for test_case in test_configs:
        try:
            # Skip PyTorch tests if transformers not available
            if test_case["config"].model_type == "pytorch" and not TRANSFORMERS_AVAILABLE:
                logger.info("Skipping PyTorch test - transformers not available")
                continue
            
            logger.info(f"Testing {test_case['config'].model_type} adapter...")
            adapter = manager.load_model(test_case["name"], test_case["config"])
            
            # Get model info
            info = manager.get_model_info(test_case["name"])
            logger.info(f"Model info: {info}")
            
            # Simple test prediction
            if test_case["config"].model_type == "pytorch":
                # For PyTorch models, we can do a simple test
                sample_input = "Hello, how are you?"
                # Note: In a real scenario, you'd need to properly tokenize the input
                # This is just for demonstration
                print(f"Adapter {test_case['name']} loaded successfully")
            
            # Unload the model
            manager.unload_model(test_case["name"])
            
        except Exception as e:
            logger.warning(f"Test failed for {test_case['name']}: {e}")
    
    logger.info("Model adapter tests completed")


if __name__ == "__main__":
    test_model_adapters()