# Bias Detection Service Reorganization

## Summary

This document summarizes the reorganization of the bias-detection folder
structure.

## Changes Made

### 1. Removed Unused `python/` Folder

- **Removed**: `/src/lib/ai/bias-detection/python/bias_detection_service.py`
- **Reason**: This was a leftover/duplicate that wasn't being used. The actual
  service is in `python-service/`.

### 2. Updated `start-python-service.py`

- **Changed**: Now imports the Flask app from
  `python-service/bias_detection_service.py`
- **Before**: Tried to import from deleted `python/` folder and created
  duplicate Flask app
- **After**: Simple wrapper that imports and re-exports the Flask app from the
  correct location

### 3. Organized Test Files

- **Moved**: Test files from `python-service/` root to `python-service/tests/`
- **Files moved**:
  - `test_bias_detection_service.py`
  - `test_bias_detection_improvements.py`

### 4. Created Documentation

- **Added**: `python-service/README.md` - Documents the structure and usage of
  both Flask and FastAPI services
- **Updated**: Root `README.md` - Fixed import path reference

## Current Structure

```
src/lib/ai/bias-detection/
├── python-service/                    # Python service implementations
│   ├── bias_detection_service.py      # Flask service (PRODUCTION)
│   ├── bias_detection/                # FastAPI service (EXPERIMENTAL)
│   │   ├── app.py
│   │   ├── config.py
│   │   ├── models.py
│   │   └── services/
│   ├── tasks.py                       # Celery tasks
│   ├── celery_config.py
│   ├── placeholder_adapters.py
│   ├── bias_utils.py
│   ├── real_ml_models.py
│   ├── tests/                         # Test files
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── README.md                      # Service documentation
├── start-python-service.py            # WSGI entry point for Gunicorn
├── gunicorn_config.py                 # Gunicorn configuration
├── Dockerfile                         # Docker configuration
└── README.md                          # Main documentation
```

## Service Implementations

### Flask Service (Production)

- **Location**: `python-service/bias_detection_service.py`
- **Status**: ✅ Production (currently in use)
- **Entry Point**: `start-python-service.py` → `bias_detection_service.app`
- **Used by**: Gunicorn, production deployments

### FastAPI Service (Experimental)

- **Location**: `python-service/bias_detection/`
- **Status**: 🧪 Experimental (not in production)
- **Entry Point**: `bias_detection.app:app`
- **Used by**: Experimental deployments, future migration target

## Usage

### Running Flask Service (Production)

```bash
# Using Gunicorn (production)
gunicorn -c gunicorn_config.py start-python-service:app

# Direct Python
cd python-service
python bias_detection_service.py
```

### Running FastAPI Service (Experimental)

```bash
# Using Uvicorn
cd python-service
uvicorn bias_detection.app:app --host 0.0.0.0 --port 8000

# Or as module
python -m bias_detection.app
```

## Migration Notes

- The Flask service remains the primary production service
- The FastAPI service is available for testing and future migration
- All imports and references have been updated to use the correct paths
- The `start-python-service.py` wrapper ensures backward compatibility

## Next Steps

1. ✅ Remove unused `python/` folder - **DONE**
2. ✅ Update `start-python-service.py` - **DONE**
3. ✅ Organize test files - **DONE**
4. ✅ Create documentation - **DONE**
5. ⏳ Consider migrating to FastAPI service in future
6. ⏳ Consolidate duplicate functionality if needed
