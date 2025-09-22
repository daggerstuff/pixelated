## TechDeck-Python Pipeline Data Transformation Layer

### Data Format Bridging Between React Frontend and Python Pipeline

This specification defines the data transformation layer that converts between React frontend data formats and Python pipeline data structures, ensuring seamless integration while maintaining data integrity and HIPAA compliance.

---

## Data Transformation Architecture

### Transformation Layer Components

```
ai/api/techdeck_integration/transformers/
├── __init__.py
├── dataset_transformer.py      # Dataset format conversions
├── conversation_transformer.py # Conversation format conversions
├── validation_transformer.py   # Validation result conversions
├── progress_transformer.py     # Progress data conversions
├── error_transformer.py        # Error response conversions
└── schema_validator.py         # Data validation utilities
```

---

## Frontend-to-Pipeline Data Transformations

### Dataset Format Transformation

```python
# transformers/dataset_transformer.py - Convert React dataset format to Python pipeline
class DatasetTransformer:
    """Transform dataset data between React frontend and Python pipeline formats"""
    
    def __init__(self, config):
        self.config = config
        self.logger = logging.getLogger(__name__)
    
    def frontend_to_pipeline(self, frontend_data: Dict) -> Dict:
        """Convert React frontend dataset format to Python pipeline format"""
        
        // TEST: Validate required fields are present
        required_fields = ['name', 'format', 'data']
        missing_fields = [field for field in required_fields if field not in frontend_data]
        if missing_fields:
            raise ValidationError(f"Missing required fields: {missing_fields}")
        
        // TEST: Normalize format strings to standard values
        format_mapping = {
            'csv': 'csv',
            'json': 'json', 
            'jsonl': 'jsonl',
            'parquet': 'parquet',
            'JSON': 'json',
            'JSONL': 'jsonl'
        }
        
        pipeline_format = format_mapping.get(frontend_data['format'].lower(), 'json')
        
        // TEST: Convert conversation data to standard schema
        conversations = self._convert_conversations(
            frontend_data.get('data', []),
            pipeline_format
        )
        
        // TEST: Extract metadata and validate privacy compliance
        metadata = self._extract_metadata(frontend_data)
        self._validate_privacy_compliance(conversations)
        
        pipeline_dataset = {
            'id': frontend_data.get('id', str(uuid.uuid4())),
            'name': frontend_data['name'],
            'description': frontend_data.get('description', ''),
            'source_type': frontend_data.get('sourceType', 'upload'),
            'source_url': frontend_data.get('sourceUrl'),
            'format': pipeline_format,
            'total_rows': len(conversations),
            'columns': self._extract_columns(conversations),
            'data': conversations,
            'metadata': metadata,
            'created_at': frontend_data.get('createdAt', datetime.utcnow().isoformat()),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        return pipeline_dataset
    
    def pipeline_to_frontend(self, pipeline_data: Dict) -> Dict:
        """Convert Python pipeline dataset format to React frontend format"""
        
        // TEST: Validate pipeline data structure
        if not isinstance(pipeline_data, dict):
            raise ValidationError("Pipeline data must be a dictionary")
        
        // TEST: Convert conversations to frontend format
        frontend_conversations = self._convert_to_frontend_conversations(
            pipeline_data.get('data', [])
        )
        
        // TEST: Map quality and bias scores
        quality_score = pipeline_data.get('quality_score')
        bias_score = pipeline_data.get('bias_score')
        
        frontend_dataset = {
            'id': pipeline_data['id'],
            'name': pipeline_data['name'],
            'description': pipeline_data.get('description'),
            'sourceType': pipeline_data.get('source_type'),
            'format': pipeline_data['format'],
            'totalRows': pipeline_data.get('total_rows', 0),
            'status': pipeline_data.get('status', 'pending'),
            'qualityScore': quality_score,
            'biasScore': bias_score,
            'createdAt': pipeline_data.get('created_at'),
            'updatedAt': pipeline_data.get('updated_at'),
            'conversations': frontend_conversations,
            'metadata': pipeline_data.get('metadata', {})
        }
        
        return frontend_dataset
    
    def _convert_conversations(self, conversations: List[Dict], format_type: str) -> List[Dict]:
        """Convert conversations to standard Python pipeline format"""
        
        standardized_conversations = []
        
        for i, conversation in enumerate(conversations):
            // TEST: Validate conversation structure
            if not isinstance(conversation, dict):
                self.logger.warning(f"Skipping invalid conversation at index {i}")
                continue
            
            // TEST: Convert based on format type
            if format_type == 'chatml':
                standardized = self._convert_chatml_conversation(conversation)
            elif format_type == 'alpaca':
                standardized = self._convert_alpaca_conversation(conversation)
            elif format_type == 'vicuna':
                standardized = self._convert_vicuna_conversation(conversation)
            elif format_type == 'sharegpt':
                standardized = self._convert_sharegpt_conversation(conversation)
            else:
                // TEST: Auto-detect format if not specified
                standardized = self._auto_detect_and_convert(conversation)
            
            // TEST: Add conversation ID and metadata
            standardized['id'] = str(uuid.uuid4())
            standardized['index'] = i
            standardized['format'] = format_type
            
            standardized_conversations.append(standardized)
        
        return standardized_conversations
    
    def _convert_chatml_conversation(self, conversation: Dict) -> Dict:
        """Convert ChatML format to standard conversation schema"""
        
        // TEST: Extract messages from ChatML format
        messages = conversation.get('messages', [])
        
        standardized = {
            'messages': [],
            'metadata': conversation.get('metadata', {})
        }
        
        for msg in messages:
            // TEST: Validate message structure
            if not all(key in msg for key in ['role', 'content']):
                self.logger.warning(f"Invalid message structure: {msg}")
                continue
            
            // TEST: Sanitize content for privacy compliance
            sanitized_content = self._sanitize_content(msg['content'])
            
            standardized['messages'].append({
                'role': msg['role'],
                'content': sanitized_content,
                'timestamp': msg.get('timestamp', datetime.utcnow().isoformat())
            })
        
        return standardized
    
    def _convert_alpaca_conversation(self, conversation: Dict) -> Dict:
        """Convert Alpaca format to standard conversation schema"""
        
        // TEST: Extract instruction/input/output from Alpaca format
        instruction = conversation.get('instruction', '')
        input_text = conversation.get('input', '')
        output = conversation.get('output', '')
        
        // TEST: Combine instruction and input if both present
        user_content = instruction
        if input_text:
            user_content += f"\n\nInput: {input_text}"
        
        standardized = {
            'messages': [
                {
                    'role': 'user',
                    'content': self._sanitize_content(user_content),
                    'timestamp': datetime.utcnow().isoformat()
                },
                {
                    'role': 'assistant', 
                    'content': self._sanitize_content(output),
                    'timestamp': datetime.utcnow().isoformat()
                }
            ],
            'metadata': conversation.get('metadata', {})
        }
        
        return standardized
    
    def _sanitize_content(self, content: str) -> str:
        """Sanitize conversation content for privacy compliance"""
        
        // TEST: Remove potential PII patterns
        pii_patterns = [
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  # Email
            r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',  # Phone numbers
            r'\b\d{3}-\d{2}-\d{4}\b',  # SSN
            r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'  # IP addresses
        ]
        
        sanitized = content
        for pattern in pii_patterns:
            sanitized = re.sub(pattern, '[REDACTED]', sanitized)
        
        return sanitized
    
    def _validate_privacy_compliance(self, conversations: List[Dict]):
        """Validate conversations meet HIPAA++ privacy requirements"""
        
        // TEST: Check for PII leakage in conversation content
        for conversation in conversations:
            messages = conversation.get('messages', [])
            
            for msg in messages:
                content = msg.get('content', '')
                
                // TEST: Validate no PHI exposure
                if self._contains_phi(content):
                    raise PrivacyViolationError(
                        f"PHI detected in conversation: {content[:100]}..."
                    )
                
                // TEST: Validate content length limits
                if len(content) > 10000:  # 10KB limit per message
                    raise ValidationError(
                        f"Message content exceeds maximum length: {len(content)} characters"
                    )
    
    def _contains_phi(self, content: str) -> bool:
        """Check if content contains Protected Health Information"""
        
        phi_indicators = [
            'patient', 'diagnosis', 'treatment', 'medical record',
            'social security', 'ssn', 'date of birth', 'dob'
        ]
        
        content_lower = content.lower()
        return any(indicator in content_lower for indicator in phi_indicators)
```

---

## Conversation Format Transformations

### Multi-Format Conversation Support

```python
# transformers/conversation_transformer.py - Handle multiple conversation formats
class ConversationTransformer:
    """Transform conversations between different format standards"""
    
    SUPPORTED_FORMATS = {
        'chatml': 'ChatML format with role-based messages',
        'alpaca': 'Alpaca instruction-following format',
        'vicuna': 'Vicuna conversation format',
        'sharegpt': 'ShareGPT shareable conversation format',
        'custom': 'Custom user-defined format'
    }
    
    def convert_format(self, conversation: Dict, source_format: str, 
                      target_format: str) -> Dict:
        """Convert conversation from source format to target format"""
        
        // TEST: Validate source and target formats
        if source_format not in self.SUPPORTED_FORMATS:
            raise ValidationError(f"Unsupported source format: {source_format}")
        
        if target_format not in self.SUPPORTED_FORMATS:
            raise ValidationError(f"Unsupported target format: {target_format}")
        
        // TEST: Convert to intermediate standard format first
        standard_format = self._to_standard_format(conversation, source_format)
        
        // TEST: Convert from standard to target format
        target_format_data = self._from_standard_format(standard_format, target_format)
        
        return target_format_data
    
    def _to_standard_format(self, conversation: Dict, format_type: str) -> Dict:
        """Convert any supported format to intermediate standard format"""
        
        // TEST: Route to appropriate conversion method
        conversion_methods = {
            'chatml': self._chatml_to_standard,
            'alpaca': self._alpaca_to_standard,
            'vicuna': self._vicuna_to_standard,
            'sharegpt': self._sharegpt_to_standard,
            'custom': self._custom_to_standard
        }
        
        method = conversion_methods.get(format_type)
        if not method:
            raise ValidationError(f"No conversion method for format: {format_type}")
        
        return method(conversation)
    
    def _chatml_to_standard(self, conversation: Dict) -> Dict:
        """Convert ChatML format to standard intermediate format"""
        
        standard = {
            'messages': [],
            'metadata': conversation.get('metadata', {}),
            'format': 'standard'
        }
        
        messages = conversation.get('messages', [])
        
        for msg in messages:
            // TEST: Validate message has required fields
            if not all(key in msg for key in ['role', 'content']):
                continue
            
            standard['messages'].append({
                'role': msg['role'],
                'content': msg['content'],
                'timestamp': msg.get('timestamp', datetime.utcnow().isoformat()),
                'metadata': msg.get('metadata', {})
            })
        
        return standard
    
    def _alpaca_to_standard(self, conversation: Dict) -> Dict:
        """Convert Alpaca format to standard intermediate format"""
        
        instruction = conversation.get('instruction', '')
        input_text = conversation.get('input', '')
        output = conversation.get('output', '')
        
        // TEST: Build user message from instruction and input
        user_content = instruction
        if input_text:
            user_content += f"\n\nInput: {input_text}"
        
        standard = {
            'messages': [
                {
                    'role': 'user',
                    'content': user_content,
                    'timestamp': datetime.utcnow().isoformat(),
                    'metadata': {'format': 'alpaca'}
                },
                {
                    'role': 'assistant',
                    'content': output,
                    'timestamp': datetime.utcnow().isoformat(),
                    'metadata': {'format': 'alpaca'}
                }
            ],
            'metadata': conversation.get('metadata', {}),
            'format': 'standard'
        }
        
        return standard
```

---

## Validation Result Transformations

### Quality Validation Response Transformation

```python
# transformers/validation_transformer.py - Convert validation results
class ValidationTransformer:
    """Transform validation results between formats"""
    
    def pipeline_to_frontend(self, validation_result: Dict) -> Dict:
        """Convert Python pipeline validation to React frontend format"""
        
        // TEST: Extract validation components
        quality_score = validation_result.get('quality_score', 0)
        bias_report = validation_result.get('bias_report', {})
        recommendations = validation_result.get('recommendations', [])
        
        // TEST: Format bias information for frontend
        frontend_bias = {
            'overallScore': bias_report.get('overall_bias_score', 0),
            'demographicBias': bias_report.get('demographic_bias', {}),
            'contentBias': bias_report.get('content_bias', {}),
            'compliant': bias_report.get('compliant', False),
            'recommendations': bias_report.get('recommendations', [])
        }
        
        frontend_validation = {
            'validationId': validation_result.get('validation_id'),
            'overallScore': quality_score,
            'qualityLevel': self._get_quality_level(quality_score),
            'biasReport': frontend_bias,
            'recommendations': recommendations,
            'status': validation_result.get('status', 'completed'),
            'timestamp': validation_result.get('timestamp', datetime.utcnow().isoformat())
        }
        
        return frontend_validation
    
    def _get_quality_level(self, score: float) -> str:
        """Convert numeric quality score to descriptive level"""
        
        // TEST: Map score ranges to quality levels
        if score >= 0.9:
            return 'excellent'
        elif score >= 0.8:
            return 'good'
        elif score >= 0.7:
            return 'acceptable'
        elif score >= 0.5:
            return 'needs_improvement'
        else:
            return 'poor'
```

---

## Progress Data Transformations

### Real-time Progress Updates

```python
# transformers/progress_transformer.py - Convert progress data
class ProgressTransformer:
    """Transform progress data between formats"""
    
    def pipeline_to_frontend(self, progress_data: Dict) -> Dict:
        """Convert pipeline progress to frontend format"""
        
        // TEST: Extract progress information
        progress_percentage = progress_data.get('progress', 0)
        current_stage = progress_data.get('current_stage', 'unknown')
        status = progress_data.get('status', 'pending')
        
        // TEST: Calculate estimated completion time
        estimated_completion = self._calculate_eta(progress_data)
        
        frontend_progress = {
            'progress': progress_percentage,
            'status': status,
            'stage': current_stage,
            'message': progress_data.get('message', ''),
            'estimatedTimeRemaining': estimated_completion,
            'currentOperation': progress_data.get('current_operation', ''),
            'bytesProcessed': progress_data.get('bytes_processed', 0),
            'totalBytes': progress_data.get('total_bytes', 0),
            'processingRate': progress_data.get('processing_rate', 0),
            'lastUpdated': progress_data.get('last_updated', datetime.utcnow().isoformat())
        }
        
        return frontend_progress
    
    def _calculate_eta(self, progress_data: Dict) -> int:
        """Calculate estimated time remaining in seconds"""
        
        // TEST: Use processing rate to estimate completion
        processing_rate = progress_data.get('processing_rate', 0)
        total_items = progress_data.get('total_items', 0)
        processed_items = progress_data.get('processed_items', 0)
        
        if processing_rate > 0 and total_items > processed_items:
            remaining_items = total_items - processed_items
            return int(remaining_items / processing_rate)
        
        return 0
```

---

## Error Response Transformations

### Standardized Error Handling

```python
# transformers/error_transformer.py - Convert error responses
class ErrorTransformer:
    """Transform error responses between formats"""
    
    def python_to_frontend(self, python_error: Exception, context: Dict = None) -> Dict:
        """Convert Python exception to frontend error format"""
        
        // TEST: Extract error information
        error_type = type(python_error).__name__
        error_message = str(python_error)
        
        // TEST: Map to frontend error codes
        error_mapping = {
            'ValidationError': 'VALIDATION_ERROR',
            'AuthenticationError': 'AUTHENTICATION_ERROR',
            'PermissionError': 'PERMISSION_DENIED',
            'DatasetNotFoundError': 'RESOURCE_NOT_FOUND',
            'RateLimitExceededError': 'RATE_LIMIT_EXCEEDED',
            'PipelineExecutionError': 'PROCESSING_ERROR',
            'PrivacyViolationError': 'PRIVACY_VIOLATION'
        }
        
        frontend_error_code = error_mapping.get(error_type, 'INTERNAL_ERROR')
        
        frontend_error = {
            'success': False,
            'error': {
                'code': frontend_error_code,
                'message': error_message,
                'type': error_type,
                'timestamp': datetime.utcnow().isoformat(),
                'requestId': context.get('request_id') if context else None
            }
        }
        
        // TEST: Add user-friendly messages for common errors
        if frontend_error_code == 'VALIDATION_ERROR':
            frontend_error['error']['userMessage'] = 'Please check your input and try again.'
        elif frontend_error_code == 'RATE_LIMIT_EXCEEDED':
            frontend_error['error']['userMessage'] = 'Too many requests. Please wait and try again.'
        elif frontend_error_code == 'RESOURCE_NOT_FOUND':
            frontend_error['error']['userMessage'] = 'The requested resource was not found.'
        
        return frontend_error
```

---

## Schema Validation Utilities

### Data Validation and Sanitization

```python
# transformers/schema_validator.py - Validate data schemas
class SchemaValidator:
    """Validate data against defined schemas"""
    
    DATASET_SCHEMA = {
        'type': 'object',
        'properties': {
            'name': {'type': 'string', 'minLength': 1, 'maxLength': 255},
            'description': {'type': 'string', 'maxLength': 1000},
            'format': {'type': 'string', 'enum': ['csv', 'json', 'jsonl', 'parquet']},
            'data': {
                'type': 'array',
                'items': {'type': 'object'}
            }
        },
        'required': ['name', 'format', 'data']
    }
    
    CONVERSATION_SCHEMA = {
        'type': 'object',
        'properties': {
            'messages': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'role': {'type': 'string', 'enum': ['system', 'user', 'assistant']},
                        'content': {'type': 'string', 'minLength': 1, 'maxLength': 10000}
                    },
                    'required': ['role', 'content']
                },
                'minItems': 1
            }
        },
        'required': ['messages']
    }
    
    def validate_dataset(self, dataset_data: Dict) -> bool:
        """Validate dataset against schema"""
        
        // TEST: Validate against JSON schema
        try:
            validate(instance=dataset_data, schema=self.DATASET_SCHEMA)
            return True
        except ValidationError as e:
            self.logger.error(f"Dataset validation failed: {e.message}")
            return False
    
    def validate_conversation(self, conversation_data: Dict) -> bool:
        """Validate conversation against schema"""
        
        // TEST: Validate conversation structure
        try:
            validate(instance=conversation_data, schema=self.CONVERSATION_SCHEMA)
            return True
        except ValidationError as e:
            self.logger.error(f"Conversation validation failed: {e.message}")
            return False
    
    def sanitize_data(self, data: Any) -> Any:
        """Recursively sanitize data to prevent injection attacks"""
        
        if isinstance(data, dict):
            return {k: self.sanitize_data(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self.sanitize_data(item) for item in data]
        elif isinstance(data, str):
            // TEST: Remove potential script injections
            sanitized = data.replace('<script>', '<script>')
            sanitized = sanitized.replace('javascript:', '')
            return sanitized
        else:
            return data
```

---

## Integration with Existing TechDeck Components

### Component-Specific Transformations

```python
# transformers/techdeck_integration.py - TechDeck-specific transformations
class TechDeckIntegrationTransformer:
    """Handle TechDeck-specific data transformations"""
    
    def transform_upload_request(self, form_data: Dict, files: Dict) -> Dict:
        """Transform file upload request to pipeline format"""
        
        // TEST: Extract file information
        uploaded_file = files.get('file')
        if not uploaded_file:
            raise ValidationError("No file provided in upload request")
        
        // TEST: Validate file type and size
        allowed_extensions = {'.csv', '.json', '.jsonl', '.parquet'}
        file_extension = os.path.splitext(uploaded_file.filename)[1].lower()
        
        if file_extension not in allowed_extensions:
            raise ValidationError(f"Unsupported file type: {file_extension}")
        
        // TEST: Create pipeline-compatible dataset structure
        pipeline_request = {
            'name': form_data.get('name', uploaded_file.filename),
            'description': form_data.get('description', f'Uploaded file: {uploaded_file.filename}'),
            'source_type': 'upload',
            'format': file_extension[1:],  # Remove leading dot
            'file_data': uploaded_file.read(),
            'metadata': {
                'original_filename': uploaded_file.filename,
                'file_size': len(uploaded_file.read()),
                'upload_timestamp': datetime.utcnow().isoformat()
            }
        }
        
        return pipeline_request
    
    def transform_conversion_request(self, conversion_data: Dict) -> Dict:
        """Transform format conversion request to pipeline format"""
        
        // TEST: Extract conversion parameters
        dataset_id = conversion_data.get('datasetId')
        source_format = conversion_data.get('sourceFormat', 'auto-detect')
        target_format = conversion_data.get('targetFormat')
        
        if not dataset_id:
            raise ValidationError("datasetId is required for conversion")
        
        if not target_format:
            raise ValidationError("targetFormat is required for conversion")
        
        // TEST: Create pipeline conversion request
        pipeline_conversion = {
            'dataset_id': dataset_id,
            'source_format': source_format,
            'target_format': target_format,
            'validate_quality': conversion_data.get('validateQuality', True),
            'metadata': {
                'conversion_timestamp': datetime.utcnow().isoformat(),
                'user_requested': True
            }
        }
        
        return pipeline_conversion
```

---

## Performance and Security Considerations

### Performance Optimization

```python
# Performance optimizations for data transformation
class TransformationOptimizer:
    """Optimize data transformation performance"""
    
    def __init__(self, config):
        self.config = config
        self.cache = {}  # Simple in-memory cache
    
    def cached_transform(self, transform_func, data: Any, cache_key: str) -> Any:
        """Apply transformation with caching for repeated data"""
        
        // TEST: Check cache for existing transformation
        if cache_key in self.cache:
            self.logger.debug(f"Cache hit for key: {cache_key}")
            return self.cache[cache_key]
        
        // TEST: Perform transformation and cache result
        result = transform_func(data)
        self.cache[cache_key] = result
        
        // TEST: Implement cache size limit
        if len(self.cache) > self.config.MAX_CACHE_SIZE:
            # Remove oldest entries
            oldest_keys = list(self.cache.keys())[:self.config.CACHE_CLEANUP_SIZE]
            for key in oldest_keys:
                del self.cache[key]
        
        return result
    
    def batch_transform(self, transform_func, data_list: List[Any], 
                       batch_size: int = 100) -> List[Any]:
        """Transform data in batches for better performance"""
        
        results = []
        
        // TEST: Process data in batches
        for i in range(0, len(data_list), batch_size):
            batch = data_list[i:i + batch_size]
            
            // TEST: Transform batch and collect results
            batch_results = [transform_func(item) for item in batch]
            results.extend(batch_results)
            
            // TEST: Log progress for large datasets
            if len(data_list) > 1000:
                progress = min(100, int((i + batch_size) / len(data_list) * 100))
                self.logger.info(f"Transformation progress: {progress}%")
        
        return results
```

### Security Validation

```python
# Security validation for transformed data
class SecurityValidator:
    """Validate data security during transformation"""
    
    def validate_no_secrets(self, data: Any) -> bool:
        """Check that no secrets are exposed in data"""
        
        // TEST: Scan for common secret patterns
        secret_patterns = [
            r'sk-[a-zA-Z0-9]{48}',  # OpenAI API key
            r'ghp_[a-zA-Z0-9]{36}',  # GitHub personal access token
            r'aws_access_key_id\s*=\s*[A-Z0-9]{20}',  # AWS access key
            r'password\s*[:=]\s*.+',  # Password patterns
            r'api_key\s*[:=]\s*.+'   # API key patterns
        ]
        
        data_str = str(data)
        
        for pattern in secret_patterns:
            if re.search(pattern, data_str, re.IGNORECASE):
                self.logger.error(f"Potential secret detected in data: {pattern}")
                return False
        
        return True
    
    def validate_size_limits(self, data: Any, max_size_bytes: int = 10485760) -> bool:
        """Validate data size doesn't exceed limits (default 10MB)"""
        
        data_size = len(str(data).encode('utf-8'))
        
        if data_size > max_size_bytes:
            self.logger.error(f"Data size {data_size} exceeds limit {max_size_bytes}")
            return False
        
        return True
```

---

## Usage Examples

### Complete Transformation Flow

```python
# Example usage of transformation layer
def example_transformation_flow():
    """Demonstrate complete data transformation flow"""
    
    // TEST: Frontend dataset upload
    frontend_dataset = {
        'name': 'Therapeutic Conversations',
        'description': 'Mental health support conversations',
        'format': 'json',
        'data': [
            {
                'messages': [
                    {'role': 'user', 'content': 'I feel anxious about my job'},
                    {'role': 'assistant', 'content': 'I understand you feel anxious'}
                ]
            }
        ],
        'sourceType': 'upload'
    }
    
    // TEST: Transform to pipeline format
    transformer = DatasetTransformer(config)
    pipeline_dataset = transformer.frontend_to_pipeline(frontend_dataset)
    
    // TEST: Process through pipeline (simulated)
    pipeline_result = {
        'id': pipeline_dataset['id'],
        'quality_score': 0.85,
        'bias_score': 0.15,
        'status': 'completed',
        'data': pipeline_dataset['data']
    }
    
    // TEST: Transform back to frontend format
    frontend_result = transformer.pipeline_to_frontend(pipeline_result)
    
    return frontend_result

# Result structure:
# {
#   'id': 'uuid-string',
#   'name': 'Therapeutic Conversations',
#   'description': 'Mental health support conversations',
#   'sourceType': 'upload',
#   'format': 'json',
#   'totalRows': 1,
#   'status': 'completed',
#   'qualityScore': 0.85,
#   'biasScore': 0.15,
#   'conversations': [...],
#   'metadata': {...}
# }
```

This data transformation layer provides comprehensive bridging between React frontend and Python pipeline data formats while maintaining security, performance, and HIPAA compliance requirements.