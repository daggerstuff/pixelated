#!/usr/bin/env python3
"""
Pixelated Empathy Bias Detection Flask Service (Modular Refactored Version).
This Flask service now delegates to the 'bias_detection' package for logic.
"""

import logging
import traceback

# Module imports from the 'bias_detection' package
from bias_detection.config import settings
from bias_detection.services.analysis_orchestrator import AnalysisOrchestrator
from bias_detection.services.bias_detection_service import BiasDetectionService
from bias_detection.services.database_service import DatabaseService
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

# Logging configuration
logging.basicConfig(level=settings.log_level, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Initialize services
load_dotenv()
bias_service = BiasDetectionService()
db_service = DatabaseService()
orchestrator = AnalysisOrchestrator(bias_service, db_service, settings)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": settings.cors_allowed_origins}})

# Initialization state
app_state = {"initialized": False}

@app.before_request
async def ensure_initialized():
    """Ensure all asynchronous services are initialized once."""
    if not app_state["initialized"]:
        try:
            logger.info("Initializing bias detection services...")
            success = await bias_service.initialize()
            if success:
                app_state["initialized"] = True
                logger.info("Services initialized successfully.")
            else:
                logger.error("Service initialization failed.")
        except Exception as e:
            logger.error(f"Error initializing services: {e}\n{traceback.format_exc()}")

@app.route("/api/v1/bias/analyze", methods=["POST"])
async def analyze_bias():
    """Analyze text or session data for bias."""
    try:
        data = request.json
        if not data:
            return jsonify({"status": "error", "message": "Missing request body"}), 400

        result = await orchestrator.analyze_session(data)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Analysis endpoint failed: {e}\n{traceback.format_exc()}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/v1/health", methods=["GET"])
async def health_check():
    """Service health check status."""
    try:
        status = await bias_service.get_health_status()
        return jsonify(status)
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

if __name__ == "__main__":
    # Start the Flask app
    app.run(host=settings.host, port=settings.port, debug=settings.debug)

