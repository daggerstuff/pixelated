"""
Therapeutic AI API - Flask Application
Exposes PII scrubbing, crisis detection, emotion validation, and bias detection services
"""

import logging
import os
import sys

from flask import Flask, jsonify, request
from flask_cors import CORS

# Add security module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "security"))

from bias_detector import TherapeuticSession, analyze_session_bias
from crisis_detection import detect_crisis_signals
from database import DatabaseService
from emotion_validator import EmotionData, validate_emotion_result
from pii_scrubber import ScrubberOptions, scan_for_pii, scrub_pii

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend integration

# Initialize Database
MONGODB_URI = os.environ.get("MONGODB_URI")
db_service = DatabaseService(MONGODB_URI) if MONGODB_URI else None

if db_service:
    db_service.connect()
else:
    logger.warning("MONGODB_URI not set. Database storage disabled.")


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    db_status = "connected" if db_service and db_service.db is not None else "disconnected"
    return jsonify(
        {
            "status": "healthy",
            "service": "Pixelated Empathy Therapeutic AI",
            "version": "1.0.0",
            "mode": "CPU-only",
            "database": db_status,
        }
    )


@app.route("/api/security/scrub-pii", methods=["POST"])
def scrub_pii_endpoint():
    """
    Scrub PII from text
    """
    try:
        data = request.json
        text = data.get("text", "")
        options_dict = data.get("options", {})
        session_id = data.get("session_id")

        options = ScrubberOptions(**options_dict) if options_dict else None
        scrubbed = scrub_pii(text, options)

        result = {
            "success": True,
            "original_length": len(text),
            "scrubbed_text": scrubbed,
            "scrubbed_length": len(scrubbed),
        }

        if db_service and session_id:
            db_service.save_analysis_result("pii_scrub", result, session_id)

        return jsonify(result)
    except Exception as e:
        logger.error(f"PII scrubbing error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/security/detect-crisis", methods=["POST"])
def detect_crisis_endpoint():
    """
    Detect crisis signals in text
    """
    try:
        data = request.json
        text = data.get("text", "")
        session_id = data.get("session_id")

        result = detect_crisis_signals(text)

        # Convert dataclass to dict (CrisisDetectionService still uses dataclasses)
        response = {
            "success": True,
            "has_crisis_signal": result.has_crisis_signal,
            "risk_level": result.risk_level.value,
            "confidence": result.confidence,
            "action_required": result.action_required,
            "escalation_protocol": result.escalation_protocol,
            "signals": [
                {
                    "category": s.category.value,
                    "severity": s.severity,
                    "keywords": s.keywords,
                    "context": s.context_snippet,
                }
                for s in result.signals
            ],
        }

        if db_service and (result.has_crisis_signal or session_id):
            # Always save crisis detection results if they show risk
            db_service.save_analysis_result("crisis_detection", response, session_id)

        return jsonify(response)
    except Exception as e:
        logger.error(f"Crisis detection error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/emotion/validate", methods=["POST"])
def validate_emotion_endpoint():
    """
    Validate emotion detection result
    """
    try:
        data = request.json
        emotion_data = EmotionData(**data)

        result = validate_emotion_result(emotion_data)
        response = {"success": True, **result.model_dump()}

        if db_service:
            db_service.save_analysis_result("emotion_validation", response, emotion_data.session_id)

        return jsonify(response)
    except Exception as e:
        logger.error(f"Emotion validation error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/bias/analyze-session", methods=["POST"])
def analyze_bias_endpoint():
    """
    Analyze therapeutic session for bias
    """
    try:
        data = request.json
        session = TherapeuticSession(**data)

        result = analyze_session_bias(session)
        response = {"success": True, **result.model_dump()}

        if db_service:
            db_service.save_analysis_result("bias_analysis", response, session.session_id)

        return jsonify(response)
    except Exception as e:
        logger.error(f"Bias analysis error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/combined/analyze-conversation", methods=["POST"])
def analyze_conversation_endpoint():
    """
    Combined analysis: PII, crisis, emotion, and bias
    """
    try:
        data = request.json
        text = data.get("text", "")
        session_id = data.get("session_id")

        response = {"success": True, "analyses": {}}

        # PII scrubbing
        if data.get("scrub_pii", True):
            scrubbed = scrub_pii(text)
            pii_scan = scan_for_pii(text)
            response["analyses"]["pii"] = {
                "scrubbed_text": scrubbed,
                "pii_found": pii_scan["found"],
                "categories": pii_scan["categories"],
            }

        # Crisis detection
        if data.get("detect_crisis", True):
            crisis = detect_crisis_signals(text)
            response["analyses"]["crisis"] = {
                "has_signal": crisis.has_crisis_signal,
                "risk_level": crisis.risk_level.value,
                "action_required": crisis.action_required,
                "protocol": crisis.escalation_protocol,
            }

        # Emotion validation (if emotion data provided)
        if data.get("validate_emotion") and "emotion_data" in data:
            emotion_data = EmotionData(**data["emotion_data"])
            emotion_result = validate_emotion_result(emotion_data)
            response["analyses"]["emotion"] = emotion_result.model_dump()

        # Bias analysis (if session data provided)
        if data.get("analyze_bias") and "session_data" in data:
            session = TherapeuticSession(**data["session_data"])
            bias_result = analyze_session_bias(session)
            response["analyses"]["bias"] = bias_result.model_dump()

        if db_service and session_id:
            db_service.save_analysis_result("combined_analysis", response, session_id)

        return jsonify(response)
    except Exception as e:
        logger.error(f"Combined analysis error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    logger.info("Starting Pixelated Empathy Therapeutic AI API")
    logger.info("Mode: CPU-only")
    logger.info("Listening on http://0.0.0.0:5000")

    app.run(host="0.0.0.0", port=5000, debug=True)
