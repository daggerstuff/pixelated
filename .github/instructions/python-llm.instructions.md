---
applyTo: 'ai/**/*.py,**/*model*.py,**/*inference*.py,**/*training*.py'
---

# Python AI/ML Development Guidelines

## Environment & Setup
- Always activate Python environment: `source .venv/bin/activate` from project root
- Use `uv` package manager for Python dependencies
- Python 3.11+ required for optimal performance
- Ensure CUDA availability for GPU operations

## Core Principles for Pixelated Empathy
- **Safety First**: All AI models must integrate bias detection and safety validation
- **Performance**: <50ms response time requirement for therapeutic conversations
- **Privacy**: Implement FHE-compatible architectures for zero-knowledge processing
- **Modularity**: Separate concerns: models, inference, training, safety validation
- **Reproducibility**: Seed all random operations for consistent therapeutic simulations
- **HIPAA Compliance**: All data handling must meet healthcare privacy standards

## Project Structure
- `ai/models/` - Model definitions and architectures
- `ai/inference/` - Real-time inference services
- `ai/training/` - Training pipelines and scripts
- `ai/safety/` - Bias detection and safety validation
- `ai/api/` - Flask/FastAPI services for model endpoints

## Therapeutic AI Architecture Pattern
```python
class TherapeuticAIModel(nn.Module):
    """Base class for therapeutic conversation models"""
    def __init__(self, config):
        super().__init__()
        self.config = config
        self.bias_detector = BiasDetectionLayer()
        self.safety_validator = SafetyValidationLayer()
        
    def forward(self, x, context=None):
        # Core model processing
        output = self._process_input(x, context)
        
        # Safety and bias validation
        bias_score = self.bias_detector(output)
        safety_score = self.safety_validator(output)
        
        return {
            'response': output,
            'bias_score': bias_score,
            'safety_score': safety_score,
            'metadata': self._generate_metadata()
        }
```

## Performance Optimization
- **Response Time Target**: <50ms for conversational AI
- **Memory Management**: Use `torch.cuda.amp` for mixed precision
- **Model Efficiency**: Implement gradient checkpointing for large models
- **GPU Utilization**: Monitor with `torch.cuda.empty_cache()`
- **Parameter Efficiency**: Use LoRA/QLoRA for fine-tuning

```python
# Optimized inference for real-time conversations
@torch.inference_mode()
def generate_therapeutic_response(model, input_text, max_length=512):
    with torch.cuda.amp.autocast():
        start_time = time.time()
        
        # Tokenize and generate
        inputs = tokenizer(input_text, return_tensors="pt").to(device)
        outputs = model.generate(
            **inputs,
            max_length=max_length,
            do_sample=True,
            temperature=0.7,
            pad_token_id=tokenizer.eos_token_id
        )
        
        response_time = (time.time() - start_time) * 1000  # ms
        
        # Ensure <50ms requirement
        if response_time > 50:
            logger.warning(f"Response time {response_time}ms exceeds 50ms target")
            
        return tokenizer.decode(outputs[0], skip_special_tokens=True)
```

## Bias Detection Integration
- **Real-time Monitoring**: Integrate `BiasDetectionEngine` in all model outputs
- **Threshold Management**: Configure bias thresholds per therapeutic scenario
- **Audit Logging**: Log all bias detection results for compliance
- **Continuous Learning**: Update bias detection models based on new data

```python
# Bias detection pipeline
class BiasDetectionPipeline:
    def __init__(self, threshold=0.7):
        self.detector = BiasDetectionEngine()
        self.threshold = threshold
        self.audit_logger = AuditLogger()
    
    def validate_response(self, response_text, context):
        bias_scores = self.detector.analyze(response_text, context)
        
        # Log for compliance
        self.audit_logger.log_bias_check({
            'response': response_text,
            'bias_scores': bias_scores,
            'timestamp': datetime.utcnow(),
            'context': context
        })
        
        # Check thresholds
        if any(score > self.threshold for score in bias_scores.values()):
            raise BiasThresholdExceeded(f"Bias detected: {bias_scores}")
            
        return bias_scores
```

## Therapeutic Model Fine-tuning
- **PEFT Methods**: Use LoRA/QLoRA for efficient therapeutic domain adaptation
- **Safety-First Training**: Include safety validation in training loop
- **Scenario-Specific**: Fine-tune for crisis intervention, trauma therapy, etc.
- **Ethical Guidelines**: Follow therapeutic ethics in training data curation

```python
# Therapeutic model fine-tuning with safety validation
class TherapeuticTrainer:
    def __init__(self, base_model, safety_validator):
        self.model = base_model
        self.safety_validator = safety_validator
        self.bias_detector = BiasDetectionEngine()
        
    def training_step(self, batch):
        outputs = self.model(**batch)
        loss = outputs.loss
        
        # Safety validation during training
        generated_text = self.model.generate(batch['input_ids'])
        safety_score = self.safety_validator.validate(generated_text)
        bias_score = self.bias_detector.analyze(generated_text)
        
        # Penalize unsafe or biased outputs
        if safety_score < 0.8 or bias_score > 0.3:
            loss += self.safety_penalty * (1 - safety_score + bias_score)
            
        return loss
```

## Privacy & Security Implementation
- **FHE Integration**: Implement fully homomorphic encryption for sensitive data
- **Zero-Knowledge Architecture**: Process therapeutic data without exposure
- **HIPAA Compliance**: Encrypt all PHI at rest and in transit
- **Audit Trails**: Comprehensive logging for regulatory compliance

```python
# FHE-compatible model inference
class FHETherapeuticModel:
    def __init__(self, model_path, fhe_context):
        self.model = self.load_encrypted_model(model_path)
        self.fhe_context = fhe_context
        
    def encrypted_inference(self, encrypted_input):
        """Process encrypted therapeutic conversation data"""
        # Perform computation on encrypted data
        encrypted_output = self.model.forward_encrypted(
            encrypted_input, 
            context=self.fhe_context
        )
        
        # Return encrypted response (client decrypts)
        return encrypted_output
        
    def validate_privacy_compliance(self, operation_log):
        """Ensure no plaintext therapeutic data was exposed"""
        for entry in operation_log:
            if self.contains_phi(entry):
                raise PrivacyViolationError("PHI detected in logs")
```

## Therapeutic AI Evaluation
- **Clinical Validity**: Validate responses against therapeutic best practices
- **Bias Metrics**: Measure fairness across demographic groups
- **Safety Scores**: Assess potential harm in therapeutic contexts
- **Response Quality**: Evaluate empathy, appropriateness, and helpfulness

```python
# Comprehensive therapeutic AI evaluation
class TherapeuticEvaluator:
    def __init__(self):
        self.clinical_validator = ClinicalValidator()
        self.bias_analyzer = BiasAnalyzer()
        self.safety_assessor = SafetyAssessor()
        
    def evaluate_model(self, model, test_scenarios):
        results = {}
        
        for scenario in test_scenarios:
            response = model.generate_response(scenario.input)
            
            results[scenario.id] = {
                'clinical_score': self.clinical_validator.score(response, scenario),
                'bias_score': self.bias_analyzer.analyze(response, scenario.demographics),
                'safety_score': self.safety_assessor.assess(response, scenario.risk_level),
                'response_time': self.measure_response_time(model, scenario.input)
            }
            
        return self.generate_evaluation_report(results)
```

## Common Issues & Solutions
- **High Latency**: Check model size, use quantization, optimize inference pipeline
- **Bias Detection Failures**: Retrain bias detection models, adjust thresholds
- **Privacy Violations**: Audit data flows, strengthen encryption, review logging
- **Safety Concerns**: Enhance safety validation, update training data filters

## Development Workflow
1. **Environment**: Activate `.venv`, ensure CUDA availability
2. **Safety First**: Implement bias detection and safety validation before model logic
3. **Modular Design**: Separate models, inference, training, and safety components
4. **Testing**: Include therapeutic scenario testing and bias validation
5. **Performance**: Validate <50ms response time requirement
6. **Compliance**: Ensure HIPAA compliance and audit trail implementation
7. **Deployment**: Use Docker containers with proper security configurations

## Code Quality Standards
- **Type Hints**: Use comprehensive type annotations for all functions
- **Error Handling**: Implement robust error handling for therapeutic contexts
- **Logging**: Use structured logging with audit trail capabilities
- **Testing**: Maintain 80%+ test coverage for critical therapeutic logic
- **Documentation**: Document all therapeutic AI components thoroughly

## Integration Points
- **Frontend**: Expose models via Flask/FastAPI endpoints in `ai/api/`
- **Database**: Store model outputs and bias scores in PostgreSQL
- **Monitoring**: Integrate with Prometheus for performance metrics
- **Security**: Use FHE libraries for encrypted computation
- **Compliance**: Log all operations for HIPAA audit requirements

## Performance Targets
- **Response Time**: <50ms for conversational interactions
- **Throughput**: Support 100+ concurrent therapeutic sessions
- **Accuracy**: >95% clinical appropriateness score
- **Safety**: <5% bias detection threshold violations
- **Availability**: 99.9% uptime for production therapeutic services