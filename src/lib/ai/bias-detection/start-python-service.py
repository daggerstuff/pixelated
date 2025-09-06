#!/usr/bin/env python3
"""
Startup script for the Pixelated Empathy Bias Detection Service

This script starts a Flask API server that provides bias detection endpoints
for the TypeScript frontend to communicate with the Python analysis engine.
"""

import asyncio
import logging
import os
import sys
from datetime import datetime

from flask import Flask, jsonify, request
from flask_cors import CORS
from pythonjsonlogger import jsonlogger

# Add the python directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from python.bias_detection_service import (
        BiasDetectionConfig,
        BiasDetectionService,
        SessionData,
    )
except ImportError:
    sys.exit(1)

# Configure JSON logging
logger = logging.getLogger(__name__)
logHandler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter()
logHandler.setFormatter(formatter)
logger.addHandler(logHandler)
logger.setLevel(logging.INFO)


# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend communication

# Global bias detection service instance
bias_service = None


def initialize_service():
    """Initialize the bias detection service"""
    global bias_service

    try:
        config = BiasDetectionConfig(
            warning_threshold=0.3,
            high_threshold=0.6,
            critical_threshold=0.8,
            enable_hipaa_compliance=True,
            enable_audit_logging=True,
        )

        bias_service = BiasDetectionService(config)
        logger.info("Bias detection service initialized successfully")
        return True

    except Exception as e:
        logger.error(f"Failed to initialize bias detection service: {e}")
        return False


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify(
        {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "service": "bias-detection",
            "version": "1.0.0",
        }
    )


@app.route("/analyze", methods=["POST"])
def analyze_session():
    """Analyze a therapeutic session for bias"""
    try:
        if not bias_service:
            return jsonify({"error": "Service not initialized"}), 500

        # Parse request data
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Validate required fields
        required_fields = ["sessionId", "content"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # Create SessionData object
        session_data = SessionData(
            session_id=data["sessionId"],
            participant_demographics=data.get("participantDemographics", {}),
            training_scenario=data.get("trainingScenario", {}),
            content=data["content"],
            ai_responses=data.get("aiResponses", []),
            expected_outcomes=data.get("expectedOutcomes", []),
            transcripts=data.get("transcripts", []),
            metadata=data.get("metadata", {}),
        )

        # Run analysis
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(bias_service.analyze_session(session_data))
        loop.close()

        logger.info(f"Analysis completed for session {data['sessionId']}")
        return jsonify(result)

    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        return jsonify({"error": "Analysis failed", "message": str(e)}), 500


@app.route("/dashboard", methods=["GET"])
def get_dashboard_data():
    """Get dashboard data for bias monitoring"""
    try:
        if not bias_service:
            return jsonify({"error": "Service not initialized"}), 500

        # Get query parameters
        request.args.get("timeRange", "24h")
        request.args.get("demographic", "all")

        # Generate mock dashboard data
        # In production, this would query your database
        dashboard_data = {
            "summary": {
                "totalSessions": 1247,
                "averageBiasScore": 0.23,
                "alertsCount": 12,
                "trendsDirection": "improving",
                "lastUpdated": datetime.now().isoformat(),
            },
            "alerts": [
                {
                    "id": "alert-001",
                    "sessionId": "session-123",
                    "level": "high",
                    "message": ("Potential gender bias detected in " "therapeutic responses"),
                    "timestamp": datetime.now().isoformat(),
                    "biasType": "gender",
                    "confidence": 0.87,
                    "affectedDemographics": ["female", "non-binary"],
                    "recommendations": [
                        "Review language patterns in AI responses",
                        "Implement gender-neutral terminology",
                    ],
                }
            ],
            "trends": {
                "biasScoreOverTime": [],
                "alertsOverTime": [],
                "demographicTrends": {},
            },
            "demographics": {
                "totalParticipants": 1247,
                "breakdown": [
                    {
                        "group": "Female",
                        "count": 623,
                        "percentage": 50.0,
                        "averageBiasScore": 0.21,
                    },
                    {
                        "group": "Male",
                        "count": 498,
                        "percentage": 39.9,
                        "averageBiasScore": 0.25,
                    },
                    {
                        "group": "Non-binary",
                        "count": 87,
                        "percentage": 7.0,
                        "averageBiasScore": 0.28,
                    },
                ],
            },
        }

        return jsonify(dashboard_data)

    except Exception as e:
        logger.error(f"Dashboard data retrieval failed: {e}")
        return (
            jsonify(
                {
                    "error": "Failed to retrieve dashboard data",
                    "message": str(e),
                }
            ),
            500,
        )


@app.route("/session/<session_id>", methods=["GET"])
def get_session_analysis(session_id):
    """Get analysis results for a specific session"""
    try:
        if not bias_service:
            return jsonify({"error": "Service not initialized"}), 500

        # In production, this would query your database for stored results
        # For now, return a mock response
        result = {
            "sessionId": session_id,
            "timestamp": datetime.now().isoformat(),
            "overallBiasScore": 0.25,
            "alertLevel": "low",
            "layerResults": {
                "preprocessing": {"biasScore": 0.2},
                "modelLevel": {"biasScore": 0.3},
                "interactive": {"biasScore": 0.2},
                "evaluation": {"biasScore": 0.3},
            },
            "recommendations": ["Continue monitoring"],
            "confidence": 0.85,
        }

        return jsonify(result)

    except Exception as e:
        logger.error(f"Session analysis retrieval failed: {e}")
        return (
            jsonify(
                {
                    "error": "Failed to retrieve session analysis",
                    "message": str(e),
                }
            ),
            500,
        )


@app.route("/metrics", methods=["GET"])
def get_metrics():
    """Get bias detection metrics"""
    try:
        if not bias_service:
            return jsonify({"error": "Service not initialized"}), 500

        # Get query parameters
        request.args.get("timeRange", "24h")
        include_details = request.args.get("includeDetails", "false").lower() == "true"

        # Generate mock metrics
        metrics = {
            "totalSessions": 1247,
            "averageBiasScore": 0.23,
            "alertCounts": {
                "critical": 2,
                "high": 8,
                "medium": 15,
                "low": 45,
            },
            "processingTime": {
                "average": 85,
                "p95": 120,
                "p99": 180,
            },  # milliseconds
            "accuracy": {
                "overall": 0.92,
                "byDemographic": {
                    "gender": 0.94,
                    "ethnicity": 0.89,
                    "age": 0.93,
                },
            },
        }

        if include_details:
            metrics["detailedBreakdown"] = {
                "biasTypes": {
                    "gender": 0.15,
                    "racial": 0.12,
                    "age": 0.08,
                    "cultural": 0.18,
                },
                "layerPerformance": {
                    "preprocessing": 0.91,
                    "modelLevel": 0.88,
                    "interactive": 0.94,
                    "evaluation": 0.89,
                },
            }

        return jsonify(metrics)

    except Exception as e:
        logger.error(f"Metrics retrieval failed: {e}")
        return jsonify({"error": "Failed to retrieve metrics", "message": str(e)}), 500


@app.errorhandler(404)
def not_found(error):
    return (
        jsonify(
            {
                "error": "Endpoint not found",
                "message": "The requested endpoint does not exist",
            }
        ),
        404,
    )


@app.errorhandler(500)
def internal_error(error):
    return (
        jsonify(
            {
                "error": "Internal server error",
                "message": "An unexpected error occurred",
            }
        ),
        500,
    )


# Initialize the bias detection service
if not initialize_service():
    logger.critical("Failed to initialize bias detection service. Exiting.")
    sys.exit(1)
else:
    logger.info("Bias detection service initialized successfully for Gunicorn.")
