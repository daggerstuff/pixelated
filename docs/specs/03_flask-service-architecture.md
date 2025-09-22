## TechDeck-Python Pipeline Flask Service Architecture

### Flask Service Design for TechDeck Integration

This specification defines the Flask service architecture that wraps the existing Python dataset pipeline components to provide REST API endpoints for the TechDeck frontend integration.

---

## Service Architecture Overview

### Core Service Components

```
ai/api/techdeck_integration/
├── __init__.py
├── app.py                    # Main Flask application
├── config.py                 # Service configuration
├── auth/
│   ├── __init__.py
│   ├── middleware.py        # Authentication middleware
│   ├── jwt_handler.py       # JWT token handling
│   └── rate_limiter.py     # Rate limiting implementation
├── routes/
│   ├── __init__.py
│   ├── datasets.py          # Dataset management endpoints
│   ├── pipeline.py          # Pipeline orchestration endpoints
│   ├── standardization.py   # Format conversion endpoints
│   ├── validation.py        # Quality validation endpoints
│   ├── analytics.py         # Analytics and monitoring endpoints
│   └── system.py            # System health endpoints
├── services/
│   ├── __init__.py
│   ├── dataset_service.py   # Dataset business logic
│   ├── pipeline_service.py  # Pipeline orchestration logic
│   ├── standardization_service.py # Format conversion logic
│   ├── validation_service.py # Quality validation logic
│   └── progress_service.py  # Progress tracking logic
├── models/
│   ├── __init__.py
│   ├── requests.py          # Request data models
│   ├── responses.py         # Response data models
│   └── database.py          # Database models
├── utils/
│   ├── __init__.py
│   ├── file_handler.py      # File upload/processing utilities
│   ├── error_handler.py     # Error handling utilities
│   ├── logger.py           # Logging configuration
│   ├── validator.py        # Input validation utilities
│   └── encryption.py       # Data encryption utilities
├── websocket/
│   ├── __init__.py
│   ├── handlers.py         # WebSocket event handlers
│   └── manager.py          # WebSocket connection manager
└── integration/
    ├── __init__.py
    ├── pipeline_adapter.py # PipelineOrchestrator adapter
    ├── bias_integration.py # Bias detection integration
    └── redis_client.py     # Redis connection management
```

---

## Core Service Configuration

### Service Configuration Schema

```python
# config.py - Service configuration with environment-based settings
class TechDeckServiceConfig:
    """Configuration for TechDeck integration service"""
    
    # Service Settings
    SERVICE_NAME = "techdeck-pipeline-service"
    SERVICE_VERSION = "1.0.0"
    DEBUG = os.getenv("DEBUG", "false").lower() == "true"
    PORT = int(os.getenv("PORT", 8000))
    HOST = os.getenv("HOST", "0.0.0.0")
    
    # Security Settings
    SECRET_KEY = os.getenv("SECRET_KEY")  # Required for JWT
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRATION_HOURS = 24
    JWT_REFRESH_EXPIRATION_DAYS = 7
    
    # Rate Limiting
    RATE_LIMIT_STORAGE_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
    RATE_LIMITS = {
        "default": "100/minute",
        "validation": "100/minute", 
        "export": "10/hour",
        "pipeline": "5/hour"
    }
    
    # File Upload Settings
    MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", 100))
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "/tmp/techdeck-uploads")
    ALLOWED_EXTENSIONS = {'.csv', '.json', '.jsonl', '.parquet'}
    
    # Pipeline Integration
    PIPELINE_ORCHESTRATOR_CONFIG = {
        "max_workers": int(os.getenv("PIPELINE_MAX_WORKERS", 4)),
        "batch_size": int(os.getenv("PIPELINE_BATCH_SIZE", 100)),
        "quality_threshold": float(os.getenv("QUALITY_THRESHOLD", 0.7)),
        "bias_threshold": float(os.getenv("BIAS_THRESHOLD", 0.3))
    }
    
    # Database Settings
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost/techdeck")
    MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/pixelated")
    
    # Redis Settings
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
    REDIS_DB = int(os.getenv("REDIS_DB", 0))
    
    # External Services
    BIAS_DETECTION_SERVICE_URL = os.getenv("BIAS_DETECTION_SERVICE_URL", "http://localhost:5001")
    HIPAA_COMPLIANCE_LEVEL = os.getenv("HIPAA_COMPLIANCE_LEVEL", "hipaa_plus_plus")
    
    # Logging Settings
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    AUDIT_LOG_FILE = os.getenv("AUDIT_LOG_FILE", "audit.log")
    
    # Performance Settings
    REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", 30))
    WEBSOCKET_PING_INTERVAL = int(os.getenv("WEBSOCKET_PING_INTERVAL", 30))
    PROGRESS_UPDATE_INTERVAL = int(os.getenv("PROGRESS_UPDATE_INTERVAL", 5))
```

---

## Authentication & Security Architecture

### JWT-Based Authentication Middleware

```python
# auth/middleware.py - Authentication middleware for Flask
class JWTAuthMiddleware:
    """JWT-based authentication middleware for TechDeck API"""
    
    def __init__(self, app, config):
        self.app = app
        self.config = config
        self.jwt_handler = JWTHandler(config)
        self.rate_limiter = RateLimiter(config)
    
    def __call__(self, environ, start_response):
        """Process incoming requests with authentication and rate limiting"""
        request = Request(environ)
        
        // TEST: Validate JWT token from Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return self._unauthorized_response(start_response)
        
        token = auth_header.split(' ')[1]
        
        // TEST: Verify token validity and extract user claims
        user_claims = self.jwt_handler.verify_token(token)
        if not user_claims:
            return self._unauthorized_response(start_response)
        
        // TEST: Apply rate limiting based on user ID
        user_id = user_claims.get('user_id')
        if not self.rate_limiter.check_rate_limit(user_id, request.path):
            return self._rate_limit_response(start_response)
        
        // TEST: Add user context to request environment
        environ['user_claims'] = user_claims
        environ['user_id'] = user_id
        
        return self.app(environ, start_response)
    
    def _unauthorized_response(self, start_response):
        """Return 401 Unauthorized response"""
        response = Response(
            json.dumps({
                'success': False,
                'error': {
                    'code': 'UNAUTHORIZED',
                    'message': 'Invalid or missing authentication token'
                }
            }),
            status=401,
            mimetype='application/json'
        )
        return response(environ, start_response)
    
    def _rate_limit_response(self, start_response):
        """Return 429 Rate Limit Exceeded response"""
        response = Response(
            json.dumps({
                'success': False,
                'error': {
                    'code': 'RATE_LIMITED',
                    'message': 'Rate limit exceeded. Please try again later.'
                }
            }),
            status=429,
            mimetype='application/json'
        )
        return response(environ, start_response)
```

### Rate Limiting Implementation

```python
# auth/rate_limiter.py - Rate limiting with Redis backend
class RateLimiter:
    """Redis-based rate limiter for API endpoints"""
    
    def __init__(self, config):
        self.config = config
        self.redis_client = redis.from_url(config.RATE_LIMIT_STORAGE_URL)
        self.limits = config.RATE_LIMITS
    
    def check_rate_limit(self, user_id: str, endpoint: str) -> bool:
        """Check if user has exceeded rate limit for specific endpoint"""
        
        // TEST: Determine rate limit based on endpoint pattern
        limit_key = self._get_limit_key(endpoint)
        limit_config = self.limits.get(limit_key, self.limits['default'])
        
        // TEST: Parse rate limit (e.g., "100/minute")
        max_requests, window = self._parse_limit_config(limit_config)
        
        // TEST: Generate Redis key for rate limiting
        key = f"rate_limit:{user_id}:{limit_key}:{window}"
        
        // TEST: Increment counter and set expiration
        current_count = self.redis_client.incr(key)
        if current_count == 1:
            self.redis_client.expire(key, self._get_window_seconds(window))
        
        // TEST: Check if limit exceeded
        return current_count <= max_requests
    
    def _get_limit_key(self, endpoint: str) -> str:
        """Determine rate limit category based on endpoint"""
        if 'validation' in endpoint:
            return 'validation'
        elif 'export' in endpoint:
            return 'export'
        elif 'pipeline' in endpoint:
            return 'pipeline'
        return 'default'
```

---

## Pipeline Service Integration

### PipelineOrchestrator Adapter

```python
# integration/pipeline_adapter.py - Adapter for existing PipelineOrchestrator
class PipelineOrchestratorAdapter:
    """Adapter to integrate existing PipelineOrchestrator with Flask API"""
    
    def __init__(self, config):
        self.config = config
        self.orchestrator = None
        self._initialize_orchestrator()
    
    def _initialize_orchestrator(self):
        """Initialize PipelineOrchestrator with proper configuration"""
        
        // TEST: Import and configure PipelineOrchestrator
        from ai.dataset_pipeline.pipeline_orchestrator import PipelineOrchestrator
        from ai.dataset_pipeline.config import PipelineConfig
        
        pipeline_config = PipelineConfig(
            max_workers=self.config.PIPELINE_ORCHESTRATOR_CONFIG['max_workers'],
            batch_size=self.config.PIPELINE_ORCHESTRATOR_CONFIG['batch_size'],
            quality_threshold=self.config.PIPELINE_ORCHESTRATOR_CONFIG['quality_threshold'],
            enable_bias_detection=True,
            enable_logging=True
        )
        
        self.orchestrator = PipelineOrchestrator(pipeline_config)
    
    def execute_pipeline(self, dataset_ids: List[str], execution_mode: str = 'adaptive') -> Dict:
        """Execute pipeline with given dataset IDs"""
        
        // TEST: Validate input parameters
        if not dataset_ids:
            raise ValueError("Dataset IDs cannot be empty")
        
        // TEST: Convert execution mode to pipeline enum
        mode_enum = self._get_execution_mode_enum(execution_mode)
        
        // TEST: Prepare pipeline configuration
        pipeline_config = {
            'dataset_ids': dataset_ids,
            'execution_mode': mode_enum,
            'enable_checkpointing': True,
            'enable_progress_tracking': True
        }
        
        // TEST: Execute pipeline with progress callback
        execution_id = str(uuid.uuid4())
        
        def progress_callback(progress_data):
            self._update_progress(execution_id, progress_data)
        
        // TEST: Start pipeline execution in background thread
        future = self._execute_pipeline_async(
            execution_id, 
            pipeline_config, 
            progress_callback
        )
        
        return {
            'execution_id': execution_id,
            'status': 'queued',
            'estimated_duration': self._estimate_duration(dataset_ids)
        }
    
    def get_execution_status(self, execution_id: str) -> Dict:
        """Get current status of pipeline execution"""
        
        // TEST: Retrieve execution status from Redis/storage
        status_key = f"pipeline_status:{execution_id}"
        status_data = self._get_from_redis(status_key)
        
        if not status_data:
            raise ValueError(f"Execution {execution_id} not found")
        
        return status_data
    
    def _execute_pipeline_async(self, execution_id: str, config: Dict, callback: Callable):
        """Execute pipeline in background thread with progress tracking"""
        
        def run_pipeline():
            try:
                // TEST: Update initial status
                self._update_status(execution_id, 'running', 0)
                
                // TEST: Execute pipeline with progress callback
                result = self.orchestrator.execute_pipeline(
                    dataset_ids=config['dataset_ids'],
                    execution_mode=config['execution_mode'],
                    progress_callback=callback
                )
                
                // TEST: Update completion status
                self._update_status(execution_id, 'completed', 100, result)
                
            except Exception as e:
                // TEST: Handle pipeline execution errors
                logger.error(f"Pipeline execution failed: {execution_id}", exc_info=True)
                self._update_status(execution_id, 'failed', 0, error=str(e))
        
        // TEST: Start background execution
        import threading
        thread = threading.Thread(target=run_pipeline, daemon=True)
        thread.start()
        
        return thread
```

---

## Progress Tracking Service

### Real-time Progress Management

```python
# services/progress_service.py - Progress tracking for long-running operations
class ProgressService:
    """Service for tracking progress of long-running operations"""
    
    def __init__(self, config):
        self.config = config
        self.redis_client = redis.from_url(config.REDIS_URL)
        self.websocket_manager = None
    
    def create_progress_tracker(self, operation_id: str, operation_type: str, 
                               total_items: int = None) -> str:
        """Create new progress tracker for operation"""
        
        // TEST: Initialize progress tracker with default values
        progress_data = {
            'operation_id': operation_id,
            'operation_type': operation_type,
            'status': 'pending',
            'progress': 0,
            'current_stage': 'initializing',
            'total_items': total_items,
            'processed_items': 0,
            'start_time': datetime.utcnow().isoformat(),
            'estimated_completion': None,
            'message': 'Operation started',
            'error': None
        }
        
        // TEST: Store progress data in Redis with TTL
        key = f"progress:{operation_id}"
        self.redis_client.setex(
            key, 
            86400,  # 24 hour TTL
            json.dumps(progress_data)
        )
        
        return operation_id
    
    def update_progress(self, operation_id: str, progress_data: Dict):
        """Update progress for specific operation"""
        
        // TEST: Retrieve existing progress data
        key = f"progress:{operation_id}"
        existing_data = self._get_progress_data(operation_id)
        
        if not existing_data:
            logger.warning(f"Progress tracker not found: {operation_id}")
            return
        
        // TEST: Merge update with existing data
        existing_data.update(progress_data)
        existing_data['last_updated'] = datetime.utcnow().isoformat()
        
        // TEST: Calculate estimated completion if possible
        if existing_data.get('total_items') and existing_data.get('processed_items'):
            existing_data = self._calculate_estimates(existing_data)
        
        // TEST: Store updated progress data
        self.redis_client.setex(key, 86400, json.dumps(existing_data))
        
        // TEST: Notify WebSocket clients of progress update
        if self.websocket_manager:
            self.websocket_manager.broadcast_progress_update(existing_data)
    
    def get_progress(self, operation_id: str) -> Dict:
        """Get current progress for operation"""
        
        // TEST: Retrieve progress data from Redis
        progress_data = self._get_progress_data(operation_id)
        
        if not progress_data:
            return {
                'error': 'Progress tracker not found',
                'operation_id': operation_id
            }
        
        return progress_data
    
    def _calculate_estimates(self, progress_data: Dict) -> Dict:
        """Calculate estimated completion time based on progress"""
        
        // TEST: Calculate completion percentage
        total = progress_data.get('total_items', 0)
        processed = progress_data.get('processed_items', 0)
        
        if total > 0:
            progress_data['progress'] = min(100, int((processed / total) * 100))
            
            // TEST: Calculate estimated completion time
            start_time = datetime.fromisoformat(progress_data['start_time'])
            elapsed_time = (datetime.utcnow() - start_time).total_seconds()
            
            if processed > 0 and elapsed_time > 0:
                processing_rate = processed / elapsed_time
                remaining_items = total - processed
                estimated_seconds = remaining_items / processing_rate if processing_rate > 0 else 0
                
                progress_data['estimated_completion'] = (
                    datetime.utcnow() + timedelta(seconds=estimated_seconds)
                ).isoformat()
                progress_data['processing_rate'] = processing_rate
        
        return progress_data
```

---

## WebSocket Integration

### Real-time Progress Updates

```python
# websocket/manager.py - WebSocket connection management
class WebSocketManager:
    """Manager for WebSocket connections and real-time updates"""
    
    def __init__(self, config):
        self.config = config
        self.connections = {}  # user_id -> set of connections
        self.lock = threading.Lock()
    
    def register_connection(self, user_id: str, websocket):
        """Register new WebSocket connection for user"""
        
        // TEST: Add connection to user's connection set
        with self.lock:
            if user_id not in self.connections:
                self.connections[user_id] = set()
            self.connections[user_id].add(websocket)
        
        logger.info(f"WebSocket connected for user: {user_id}")
    
    def unregister_connection(self, user_id: str, websocket):
        """Remove WebSocket connection for user"""
        
        // TEST: Remove connection from user's connection set
        with self.lock:
            if user_id in self.connections:
                self.connections[user_id].discard(websocket)
                if not self.connections[user_id]:
                    del self.connections[user_id]
        
        logger.info(f"WebSocket disconnected for user: {user_id}")
    
    def broadcast_progress_update(self, progress_data: Dict):
        """Broadcast progress update to all connected users"""
        
        // TEST: Send progress update to all active connections
        message = {
            'type': 'progress_update',
            'data': progress_data
        }
        
        disconnected = []
        
        with self.lock:
            for user_id, connections in self.connections.items():
                for websocket in connections.copy():
                    try:
                        websocket.send(json.dumps(message))
                    except Exception as e:
                        // TEST: Mark failed connections for cleanup
                        disconnected.append((user_id, websocket))
                        logger.warning(f"Failed to send to WebSocket: {e}")
        
        // TEST: Clean up disconnected WebSockets
        for user_id, websocket in disconnected:
            self.unregister_connection(user_id, websocket)
    
    def send_to_user(self, user_id: str, message: Dict):
        """Send message to specific user"""
        
        // TEST: Send message to all connections for specific user
        with self.lock:
            connections = self.connections.get(user_id, set())
            
            for websocket in connections.copy():
                try:
                    websocket.send(json.dumps(message))
                except Exception as e:
                    logger.warning(f"Failed to send to user {user_id}: {e}")
                    self.unregister_connection(user_id, websocket)
```

---

## Error Handling Architecture

### Comprehensive Error Handler

```python
# utils/error_handler.py - Centralized error handling
class TechDeckErrorHandler:
    """Centralized error handling for TechDeck integration service"""
    
    def __init__(self, config):
        self.config = config
        self.logger = self._setup_logger()
    
    def handle_error(self, error: Exception, context: Dict = None) -> Dict:
        """Convert exception to standardized error response"""
        
        // TEST: Determine error type and appropriate response
        error_type = type(error).__name__
        error_mapping = {
            'ValidationError': (400, 'BAD_REQUEST'),
            'AuthenticationError': (401, 'UNAUTHORIZED'),
            'PermissionError': (403, 'FORBIDDEN'),
            'DatasetNotFoundError': (404, 'NOT_FOUND'),
            'RateLimitExceededError': (429, 'RATE_LIMITED'),
            'PipelineExecutionError': (500, 'INTERNAL_ERROR'),
            'FileProcessingError': (422, 'UNPROCESSABLE_ENTITY')
        }
        
        status_code, error_code = error_mapping.get(
            error_type, 
            (500, 'INTERNAL_ERROR')
        )
        
        // TEST: Create standardized error response
        error_response = {
            'success': False,
            'error': {
                'code': error_code,
                'message': str(error),
                'type': error_type,
                'timestamp': datetime.utcnow().isoformat(),
                'request_id': context.get('request_id') if context else None
            }
        }
        
        // TEST: Add detailed error information in development mode
        if self.config.DEBUG and context:
            error_response['error']['details'] = {
                'context': context,
                'traceback': traceback.format_exc()
            }
        
        // TEST: Log error with appropriate level
        self._log_error(error, error_code, context)
        
        return error_response, status_code
    
    def _log_error(self, error: Exception, error_code: str, context: Dict):
        """Log error with appropriate level and audit trail"""
        
        // TEST: Determine log level based on error type
        if error_code in ['UNAUTHORIZED', 'FORBIDDEN']:
            log_level = logging.WARNING
        elif error_code in ['INTERNAL_ERROR', 'SERVICE_UNAVAILABLE']:
            log_level = logging.ERROR
        else:
            log_level = logging.INFO
        
        // TEST: Create structured log entry
        log_entry = {
            'error_code': error_code,
            'error_message': str(error),
            'error_type': type(error).__name__,
            'context': context,
            'user_id': context.get('user_id') if context else None,
            'request_id': context.get('request_id') if context else None
        }
        
        // TEST: Log with appropriate level
        self.logger.log(log_level, f"TechDeck API Error: {error_code}", extra=log_entry)
        
        // TEST: Write to audit log for security-related errors
        if error_code in ['UNAUTHORIZED', 'FORBIDDEN', 'RATE_LIMITED']:
            self._write_audit_log(log_entry)
```

---

## Service Integration with Existing Pipeline

### Pipeline Service Adapter

```python
# services/pipeline_service.py - Business logic for pipeline operations
class PipelineService:
    """Business logic service for pipeline operations"""
    
    def __init__(self, config, pipeline_adapter, progress_service):
        self.config = config
        self.pipeline_adapter = pipeline_adapter
        self.progress_service = progress_service
        self.dataset_service = DatasetService(config)
    
    def execute_pipeline(self, user_id: str, request_data: Dict) -> Dict:
        """Execute complete pipeline with validation and progress tracking"""
        
        try:
            // TEST: Validate request data
            validation_result = self._validate_pipeline_request(request_data)
            if not validation_result['valid']:
                raise ValidationError(validation_result['errors'])
            
            // TEST: Retrieve datasets for processing
            dataset_ids = request_data['dataset_ids']
            datasets = self.dataset_service.get_datasets_by_ids(dataset_ids, user_id)
            
            if len(datasets) != len(dataset_ids):
                raise DatasetNotFoundError("One or more datasets not found")
            
            // TEST: Create progress tracker
            progress_id = self.progress_service.create_progress_tracker(
                operation_id=str(uuid.uuid4()),
                operation_type='pipeline_execution',
                total_items=sum(d.get('total_rows', 0) for d in datasets)
            )
            
            // TEST: Start pipeline execution
            execution_result = self.pipeline_adapter.execute_pipeline(
                dataset_ids=dataset_ids,
                execution_mode=request_data.get('execution_mode', 'adaptive')
            )
            
            // TEST: Link progress tracker to execution
            execution_result['progress_id'] = progress_id
            
            return {
                'success': True,
                'data': execution_result,
                'message': 'Pipeline execution started successfully'
            }
            
        except Exception as e:
            // TEST: Handle errors and update progress
            error_response = self._handle_pipeline_error(e, user_id)
            if 'progress_id' in locals():
                self.progress_service.update_progress(
                    progress_id,
                    {'status': 'error', 'error': str(e)}
                )
            raise
    
    def _validate_pipeline_request(self, request_data: Dict) -> Dict:
        """Validate pipeline execution request"""
        
        errors = []
        
        // TEST: Validate dataset_ids presence
        if 'dataset_ids' not in request_data:
            errors.append("dataset_ids is required")
        elif not isinstance(request_data['dataset_ids'], list):
            errors.append("dataset_ids must be an array")
        elif len(request_data['dataset_ids']) == 0:
            errors.append("dataset_ids cannot be empty")
        
        // TEST: Validate execution mode
        execution_mode = request_data.get('execution_mode', 'adaptive')
        valid_modes = ['sequential', 'concurrent', 'adaptive', 'priority_based']
        if execution_mode not in valid_modes:
            errors.append(f"execution_mode must be one of: {valid_modes}")
        
        // TEST: Validate quality threshold
        quality_threshold = request_data.get('quality_threshold', 0.7)
        if not isinstance(quality_threshold, (int, float)):
            errors.append("quality_threshold must be a number")
        elif not (0 <= quality_threshold <= 1):
            errors.append("quality_threshold must be between 0 and 1")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors
        }
```

---

## Service Startup and Configuration

### Application Factory Pattern

```python
# app.py - Main Flask application with factory pattern
def create_app(config=None):
    """Create and configure Flask application"""
    
    app = Flask(__name__)
    
    // TEST: Load configuration
    if config is None:
        config = TechDeckServiceConfig()
    app.config.from_object(config)
    
    // TEST: Initialize extensions
    _init_extensions(app, config)
    
    // TEST: Register blueprints
    _register_blueprints(app)
    
    // TEST: Register error handlers
    _register_error_handlers(app, config)
    
    // TEST: Register middleware
    _register_middleware(app, config)
    
    return app

def _init_extensions(app, config):
    """Initialize Flask extensions"""
    
    // TEST: Initialize CORS
    CORS(app, origins=config.ALLOWED_ORIGINS)
    
    // TEST: Initialize Redis
    app.redis_client = redis.from_url(config.REDIS_URL)
    
    // TEST: Initialize services
    app.pipeline_adapter = PipelineOrchestratorAdapter(config)
    app.progress_service = ProgressService(config)
    app.error_handler = TechDeckErrorHandler(config)

def _register_blueprints(app):
    """Register API route blueprints"""
    
    from .routes.datasets import datasets_bp
    from .routes.pipeline import pipeline_bp
    from .routes.standardization import standardization_bp
    from .routes.validation import validation_bp
    from .routes.analytics import analytics_bp
    from .routes.system import system_bp
    
    app.register_blueprint(datasets_bp, url_prefix='/api/v1/datasets')
    app.register_blueprint(pipeline_bp, url_prefix='/api/v1/pipeline')
    app.register_blueprint(standardization_bp, url_prefix='/api/v1/standardization')
    app.register_blueprint(validation_bp, url_prefix='/api/v1/validation')
    app.register_blueprint(analytics_bp, url_prefix='/api/v1/analytics')
    app.register_blueprint(system_bp, url_prefix='/api/v1/system')

if __name__ == '__main__':
    app = create_app()
    app.run(host=app.config['HOST'], port=app.config['PORT'], debug=app.config['DEBUG'])
```

---

## Integration Points with Existing TechDeck Components

### Frontend Component Mapping

| TechDeck Component | Flask API Endpoint | Integration Notes |
|-------------------|-------------------|-------------------|
| **UploadSection** | `POST /api/v1/datasets` | Multipart form data with file upload |
| **ConversionPanel** | `POST /api/v1/standardization/conversation` | Chat template conversion |
| **DatasetPreview** | `GET /api/v1/datasets/{id}` | Dataset details and preview |
| **Progress Indicators** | `GET /api/v1/datasets/{id}/progress` | Real-time progress updates |
| **Export Functionality** | `GET /api/v1/datasets/{id}/export` | Multi-format dataset export |
| **Quality Validation** | `POST /api/v1/validation/quality` | Quality scoring and recommendations |

### Data Transformation Layer

```python
# utils/transformer.py - Data transformation between React and Python
class TechDeckDataTransformer:
    """Transform data between React frontend format and Python pipeline format"""
    
    def convert_frontend_dataset(self, frontend_data: Dict) -> Dict:
        """Convert React frontend dataset format to Python pipeline format"""
        
        // TEST: Map frontend fields to pipeline schema
        pipeline_dataset = {
            'id': frontend_data.get('id', str(uuid.uuid4())),
            'name': frontend_data['name'],
            'description': frontend_data.get('description', ''),
            'source_type': frontend_data.get('sourceType', 'upload'),
            'format': self._normalize_format(frontend_data.get('format')),
            'data': self._convert_conversations(frontend_data.get('data', [])),
            'metadata': frontend_data.get('metadata', {})
        }
        
        return pipeline_dataset
    
    def convert_pipeline_response(self, pipeline_data: Dict) -> Dict:
        """Convert Python pipeline response to React frontend format"""
        
        // TEST: Map pipeline results to frontend schema
        frontend_response = {
            'id': pipeline_data['id'],
            'name': pipeline_data['name'],
            'description': pipeline_data.get('description'),
            'sourceType': pipeline_data.get('source_type'),
            'format': pipeline_data.get('format'),
            'totalRows': pipeline_data.get('total_rows', 0),
            'status': pipeline_data.get('status', 'pending'),
            'qualityScore': pipeline_data.get('quality_score'),
            'biasScore': pipeline_data.get('bias_score'),
            'createdAt': pipeline_data.get('created_at'),
            'updatedAt': pipeline_data.get('updated_at'),
            'conversations': self._convert_to_frontend_conversations(
                pipeline_data.get('data', [])
            )
        }
        
        return frontend_response
    
    def _normalize_format(self, format_str: str) -> str:
        """Normalize format string to standard values"""
        
        format_mapping = {
            'csv': 'csv',
            'json': 'json',
            'jsonl': 'jsonl',
            'parquet': 'parquet',
            'JSON': 'json',
            'JSONL': 'jsonl'
        }
        
        return format_mapping.get(format_str.lower(), 'json')
```

This Flask service architecture provides a comprehensive foundation for integrating the TechDeck React frontend with the existing Python dataset pipeline, maintaining HIPAA compliance, and providing enterprise-grade reliability and performance.