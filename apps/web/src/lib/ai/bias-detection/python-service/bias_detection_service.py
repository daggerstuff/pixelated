#!/usr/bin/env python3
"""
Pixelated Empathy Bias Detection Flask Service (Modular Refactored Version).
This Flask service now delegates to the 'bias_detection' package for logic.
"""

import asyncio
import logging
import threading
import traceback
from collections.abc import Coroutine
from typing import Any

from bias_detection.compat import (
    AuditLogger,
    BiasDetectionConfig,
    LegacyBiasDetectionService,
    SecurityManager,
    SessionData,
)

# Module imports from the 'bias_detection' package
from bias_detection.config import settings
from bias_detection.services.analysis_orchestrator import AnalysisOrchestrator
from bias_detection.services.database_service import DatabaseService
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

# Logging configuration
logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Backward-compatible public symbol names expected by legacy imports.
BiasDetectionService = LegacyBiasDetectionService

__all__ = [
    "AuditLogger",
    "BiasDetectionConfig",
    "BiasDetectionService",
    "SecurityManager",
    "SessionData",
    "app",
]

# Initialize services
load_dotenv()
bias_service = BiasDetectionService()
db_service = DatabaseService()
orchestrator = AnalysisOrchestrator(bias_service, db_service, settings)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": settings.cors_allowed_origins}})

# Initialization state
app_state = {"initialized": False}
_init_lock = threading.Lock()


class _ServiceLoop:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._thread: threading.Thread | None = None

    def get(self) -> asyncio.AbstractEventLoop:
        with self._lock:
            if (
                self._loop is not None
                and self._thread is not None
                and self._thread.is_alive()
                and not self._loop.is_closed()
            ):
                return self._loop

            loop = asyncio.new_event_loop()
            thread = threading.Thread(target=_run_service_loop, args=(loop,), daemon=True)
            thread.start()
            self._loop = loop
            self._thread = thread
            return loop


_service_loop = _ServiceLoop()


def _run_service_loop(loop: asyncio.AbstractEventLoop) -> None:
    asyncio.set_event_loop(loop)
    loop.run_forever()


def run_async[T](coro: Coroutine[Any, Any, T]) -> T:
    """Run an async service call on the service's dedicated event loop."""
    return asyncio.run_coroutine_threadsafe(coro, _service_loop.get()).result()


@app.before_request
def ensure_initialized():
    """Ensure all asynchronous services are initialized once."""
    if app_state["initialized"]:
        return

    with _init_lock:
        if app_state["initialized"]:
            return
        try:
            logger.info("Initializing bias detection services...")
            success = run_async(bias_service.initialize())
            if success:
                app_state["initialized"] = True
                logger.info("Services initialized successfully.")
            else:
                logger.error("Service initialization failed.")
        except Exception as e:
            logger.error(f"Error initializing services: {e}\n{traceback.format_exc()}")


@app.route("/api/v1/bias/analyze", methods=["POST"])
def analyze_bias():
    """Analyze text or session data for bias."""
    try:
        data = request.json
        if not data:
            return jsonify({"status": "error", "message": "Missing request body"}), 400

        result = run_async(orchestrator.analyze_session(data))
        return jsonify(result)
    except Exception as e:
        logger.error(f"Analysis endpoint failed: {e}\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": "Internal server error"}), 500


@app.route("/health", methods=["GET"])
@app.route("/api/v1/health", methods=["GET"])
def health_check():
    """Service health check status."""
    try:
        status = run_async(bias_service.get_health_status())
        return jsonify(status)
    except Exception:
        return jsonify({"status": "unhealthy", "error": "Health check failed"}), 500


_LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}


if __name__ == "__main__":
    # Local development only. In production run under gunicorn
    # (see setup.sh / start_service.sh), behind the TLS reverse proxy.
    if settings.host not in _LOOPBACK_HOSTS and not settings.debug:
        logger.warning(
            "Starting the Werkzeug development server on non-loopback host %s:%s. "
            "It speaks plain HTTP only and should not be exposed publicly; "
            "use gunicorn behind the reverse proxy instead.",
            settings.host,
            settings.port,
        )
    app.run(host=settings.host, port=settings.port, debug=settings.debug)
