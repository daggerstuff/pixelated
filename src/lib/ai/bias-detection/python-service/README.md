# Bias Detection Python Service

This directory contains the Python service implementations for bias detection.

## Structure

### Production Service (Flask)
- **`bias_detection_service.py`** - Main Flask service (production)
- **`tasks.py`** - Celery tasks for distributed processing
- **`celery_config.py`** - Celery configuration
- **`placeholder_adapters.py`** - Placeholder implementations for testing
- **`bias_utils.py`** - Utility functions
- **`real_ml_models.py`** - ML model implementations

### FastAPI Service (Experimental)
- **`bias_detection/`** - FastAPI-based service package (experimental/alternative implementation)
  - `app.py` - FastAPI application
  - `config.py` - Configuration
  - `models.py` - Pydantic models
  - `services/` - Service implementations

### Testing
- **`test_bias_detection_service.py`** - Tests for Flask service
- **`test_bias_detection_improvements.py`** - Improvement tests

## Usage

### Flask Service (Production)

The Flask service is the current production implementation:

```bash
# Using gunicorn (production)
gunicorn -c ../gunicorn_config.py start-python-service:app

# Or directly
python bias_detection_service.py
```

### FastAPI Service (Experimental)

The FastAPI service is an experimental/alternative implementation:

```bash
# Using uvicorn
uvicorn bias_detection.app:app --host 0.0.0.0 --port 8000

# Or using the module
python -m bias_detection.app
```

## Dependencies

See `requirements.txt` and `pyproject.toml` for dependencies.

## Notes

- The Flask service (`bias_detection_service.py`) is the primary production service
- The FastAPI service (`bias_detection/`) is experimental and not yet in production
- Both services share similar functionality but use different frameworks
- Consider migrating to FastAPI in the future for better async support and modern Python practices

