"""
Therapeutic AI API - Flask Application
Exposes PII scrubbing, crisis detection, emotion validation, bias detection,
and fine-tuning job management services.
"""

import json
import logging
import os
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

# Add security module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "security"))

from auth import authenticate
from bias_detector import TherapeuticSession, analyze_session_bias
from crisis_detection import detect_crisis_signals
from database import DatabaseService
from dream.consolidation import dream_bp
from emotion_validator import EmotionData, validate_emotion_result
from pii_scrubber import ScrubberOptions, scan_for_pii, scrub_pii

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend integration

API_VERSION = 1


@app.after_request
def add_version_header(response):
    """Add X-API-Version header to all /api/ responses."""
    if request.path.startswith("/api/"):
        response.headers["X-API-Version"] = str(API_VERSION)
    return response


# Register blueprints
app.register_blueprint(dream_bp)

# Initialize Database
MONGODB_URI = os.environ.get("MONGODB_URI")
db_service = DatabaseService(MONGODB_URI) if MONGODB_URI else None

if db_service:
    db_service.connect()
else:
    logger.warning("MONGODB_URI not set. Database storage disabled.")

# ─── In-Memory Fine-Tuning Job Store (PIX-3926) ───────────────────────────────
# Production rollout will replace this with Redis + Mongo persistence.

_training_jobs: dict[str, dict] = {}
_training_lock = threading.Lock()
_JOB_TTL_SECONDS = 24 * 60 * 60  # 24 hours


def _cleanup_old_jobs() -> None:
    """Evict training jobs older than _JOB_TTL_SECONDS to prevent unbounded growth."""
    cutoff = time.time() - _JOB_TTL_SECONDS
    with _training_lock:
        expired = [jid for jid, job in _training_jobs.items() if job.get("created_at", 0) < cutoff]
        expired_procs: list[tuple[str, subprocess.Popen]] = []
        for jid in expired:
            job = _training_jobs[jid]
            proc = job.get("proc")
            if proc and proc.poll() is None:
                expired_procs.append((jid, proc))
            del _training_jobs[jid]
            logger.info(f"[training] evicted expired job {jid}")

    # Terminate procs outside the lock so status/cancel/list aren't blocked.
    for jid, proc in expired_procs:
        try:
            proc.terminate()
            proc.wait(timeout=2)
        except Exception:
            proc.kill()
            proc.wait()
        logger.info(f"[training] terminated expired proc for job {jid}")


def _training_script_path() -> str:
    """Resolve the path to the fine-tuning script.

    Tries multiple locations to accommodate both local dev and container layouts.
    """
    candidates = [
        # Local dev: project root / ai / training / finetune_model.py
        Path(__file__).parent.parent / "ai" / "training" / "finetune_model.py",
        # Container layout: script may be copied to /app/ai/training/
        Path("/app/ai/training/finetune_model.py"),
        # Alternative container layout
        Path("/opt/pixelated/ai/training/finetune_model.py"),
    ]
    for script in candidates:
        if script.exists():
            return str(script.resolve())
    # Fallback to the first candidate; the spawn will fail with a clear FileNotFoundError
    return str(candidates[0])


def _sanitize_dataset_dir(dataset_path: str) -> str:
    """Validate dataset path and return a safe directory, preventing path traversal."""
    allowed_bases = ["./data/finetuning", "./data/training", "/tmp"]
    if not dataset_path:
        return "./data/finetuning"
    path = Path(dataset_path).resolve()
    for base in allowed_bases:
        base_resolved = Path(base).resolve()
        try:
            path.relative_to(base_resolved)
            if path == base_resolved:
                return str(base_resolved)
            return str(path.parent)
        except ValueError:
            continue
    logger.warning(f"[training] dataset path {dataset_path} outside allowed bases; falling back to default")
    return "./data/finetuning"


# Allowed models for fine-tuning (allowlist)
_ALLOWED_MODELS = {
    "meta-llama/Llama-2-7b-hf",
    "meta-llama/Llama-2-13b-hf",
    "mistralai/Mistral-7B-v0.1",
    "google/gemma-2b",
}

# Hyperparameter bounds
_MAX_EPOCHS = 100
_MAX_BATCH_SIZE = 128
_MIN_LEARNING_RATE = 1e-7
_MAX_LEARNING_RATE = 1e-2


def _validate_training_payload(payload: dict) -> None:
    """Validate training job payload before spawning subprocess.

    Raises ValueError with a descriptive message if any field is invalid.
    """
    model = payload.get("model", "meta-llama/Llama-2-7b-hf")
    if model not in _ALLOWED_MODELS:
        raise ValueError(f"Model '{model}' is not in the allowed allowlist.")

    dataset = payload.get("dataset", "")
    if dataset:
        safe_dir = _sanitize_dataset_dir(dataset)
        if safe_dir != dataset:
            logger.warning(f"[training] dataset path sanitized from {dataset!r} to {safe_dir!r}")

    epochs = payload.get("epochs", 3)
    if not isinstance(epochs, (int, float)) or epochs < 1 or epochs > _MAX_EPOCHS:
        raise ValueError(f"epochs must be an integer between 1 and {_MAX_EPOCHS}, got {epochs}")

    batch_size = payload.get("batch_size", 8)
    if not isinstance(batch_size, (int, float)) or batch_size < 1 or batch_size > _MAX_BATCH_SIZE:
        raise ValueError(f"batch_size must be an integer between 1 and {_MAX_BATCH_SIZE}, got {batch_size}")

    lr = payload.get("learning_rate")
    if lr is not None:
        if not isinstance(lr, (int, float)) or lr < _MIN_LEARNING_RATE or lr > _MAX_LEARNING_RATE:
            raise ValueError(
                f"learning_rate must be a number between {_MIN_LEARNING_RATE} and {_MAX_LEARNING_RATE}, got {lr}"
            )


def _drain_stream(stream, buffer: list):
    """Continuously read from a stream into a buffer list to prevent pipe blocking."""
    try:
        for line in stream:
            buffer.append(line)
    except Exception as e:
        logger.debug(f"[training] stream read error: {e}")


def _spawn_training_job(job_id: str, payload: dict) -> subprocess.Popen:
    """Spawn the fine-tuning subprocess and return the Popen handle."""
    script = _training_script_path()
    dataset_dir = _sanitize_dataset_dir(payload.get("dataset", ""))

    args = [
        sys.executable,
        script,
        "--dataset-dir",
        dataset_dir,
        "--output-dir",
        f"./models/fine-tuned/{job_id}",
        "--base-model",
        payload.get("model", "meta-llama/Llama-2-7b-hf"),
        "--epochs",
        str(payload.get("epochs", 3)),
        "--batch-size",
        str(payload.get("batch_size", 8)),
    ]

    if payload.get("learning_rate") is not None:
        args.extend(["--learning-rate", str(payload["learning_rate"])])

    logger.info(f"[training {job_id}] spawning: {' '.join(args)}")

    return subprocess.Popen(
        args,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )


def _update_job_status(job_id: str) -> None:
    """Poll the subprocess and update the job record."""
    with _training_lock:
        job = _training_jobs.get(job_id)
        if not job:
            return
        proc = job.get("proc")
        if not proc:
            return

        ret = proc.poll()
        if ret is None:
            job["status"] = "running"
        elif ret == 0:
            job["status"] = "succeeded"
            # Use buffered output (drained by background threads) instead of
            # reading directly from the pipe, which could block.
            stdout = "".join(job.get("stdout_buffer", []))
            job["stdout"] = stdout
            # Try to parse final JSON line for fine_tuned_model
            for line in reversed(stdout.splitlines()):
                stripped_line = line.strip()
                if stripped_line.startswith("{"):
                    try:
                        parsed = json.loads(stripped_line)
                        if isinstance(parsed.get("fine_tuned_model"), str):
                            job["fine_tuned_model"] = parsed["fine_tuned_model"]
                    except json.JSONDecodeError:
                        continue
            if not job.get("fine_tuned_model"):
                job["fine_tuned_model"] = f"{job['model']}:trained:{job_id[:8]}"
        else:
            job["status"] = "failed"
            stderr = "".join(job.get("stderr_buffer", []))
            job["stderr"] = stderr
            job["error"] = f"Subprocess exited with code {ret}"


# ─── Training Routes ──────────────────────────────────────────────────────────


@app.route("/api/training/jobs", methods=["POST"])
@authenticate
def create_training_job():
    """Submit a new fine-tuning job."""
    try:
        data = request.json or {}
        _validate_training_payload(data)

        job_id = f"hf-{int(time.time() * 1000)}-{uuid.uuid4().hex[:6]}"

        _cleanup_old_jobs()

        proc = _spawn_training_job(job_id, data)

        with _training_lock:
            _training_jobs[job_id] = {
                "id": job_id,
                "model": data.get("model", "meta-llama/Llama-2-7b-hf"),
                "status": "queued",
                "created_at": time.time(),
                "proc": proc,
                "fine_tuned_model": None,
                "stdout_buffer": [],
                "stderr_buffer": [],
            }
            # Start background threads to drain stdout/stderr so the OS pipe
            # buffer never fills up and blocks the subprocess (PIX-3926).
            threading.Thread(
                target=_drain_stream, args=(proc.stdout, _training_jobs[job_id]["stdout_buffer"]), daemon=True
            ).start()
            threading.Thread(
                target=_drain_stream, args=(proc.stderr, _training_jobs[job_id]["stderr_buffer"]), daemon=True
            ).start()

        # Immediate status update so it reflects running if already started
        _update_job_status(job_id)

        logger.info(f"[training] created job {job_id}")
        job = _training_jobs[job_id].copy()
        job.pop("proc", None)
        job.pop("stdout", None)
        job.pop("stderr", None)
        job.pop("stdout_buffer", None)
        job.pop("stderr_buffer", None)
        return jsonify({"success": True, "job": job}), 202
    except Exception as e:
        logger.error(f"Training job creation error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/training/jobs/<job_id>", methods=["GET"])
@authenticate
def get_training_job(job_id):
    """Get the status of a fine-tuning job."""
    _update_job_status(job_id)

    with _training_lock:
        job = _training_jobs.get(job_id)
        if not job:
            return jsonify({"success": False, "error": "Job not found"}), 404

        job_copy = job.copy()
        job_copy.pop("proc", None)
        job_copy.pop("stdout", None)
        job_copy.pop("stderr", None)
        job_copy.pop("stdout_buffer", None)
        job_copy.pop("stderr_buffer", None)

    return jsonify({"success": True, "job": job_copy})


def _cancel_proc(proc: subprocess.Popen) -> None:
    """Terminate and wait for a subprocess without holding any locks."""
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()


@app.route("/api/training/jobs/<job_id>/cancel", methods=["POST"])
@authenticate
def cancel_training_job(job_id):
    """Cancel a running fine-tuning job."""
    with _training_lock:
        job = _training_jobs.get(job_id)
        if not job:
            return jsonify({"success": False, "error": "Job not found"}), 404

        # Don't overwrite terminal states (succeeded/failed) with cancelled.
        if job.get("status") in ("succeeded", "failed"):
            return jsonify({"success": False, "error": "Job already finished"}), 409

        proc = job.get("proc")
        should_cancel = proc is not None and proc.poll() is None

    if should_cancel:
        _cancel_proc(proc)
        with _training_lock:
            _training_jobs[job_id]["status"] = "cancelled"
        logger.info(f"[training] cancelled job {job_id}")
    else:
        # Proc may have just finished; reconcile status before overwriting.
        _update_job_status(job_id)
        with _training_lock:
            job = _training_jobs.get(job_id)
            if job and job.get("status") in ("succeeded", "failed"):
                return jsonify({"success": False, "error": f"Job already finished with status {job['status']}"}), 409
            if job:
                _training_jobs[job_id]["status"] = "cancelled"

    with _training_lock:
        job = _training_jobs.get(job_id)
        model = job.get("model", "local") if job else "local"

    return jsonify({"success": True, "job": {"id": job_id, "status": "cancelled", "model": model}})


@app.route("/api/training/models", methods=["GET"])
@authenticate
def list_training_models():
    """List available fine-tunable models."""
    models = [
        {"id": "meta-llama/Llama-2-7b-hf", "owned_by": "meta", "fine_tunable": True},
        {"id": "meta-llama/Llama-2-13b-hf", "owned_by": "meta", "fine_tunable": True},
        {"id": "mistralai/Mistral-7B-v0.1", "owned_by": "mistralai", "fine_tunable": True},
        {"id": "google/gemma-2b", "owned_by": "google", "fine_tunable": True},
    ]
    return jsonify({"success": True, "models": models})


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
@authenticate
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
@authenticate
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
@authenticate
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
@authenticate
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
@authenticate
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
    import os

    # Control debug mode via environment variable for security
    # Set FLASK_DEBUG=1 or DEBUG=1 to enable debug mode in development
    debug_mode = os.environ.get("FLASK_DEBUG", "").lower() in ("1", "true", "yes") or os.environ.get(
        "DEBUG", ""
    ).lower() in ("1", "true", "yes")

    logger.info("Starting Pixelated Empathy Therapeutic AI API")
    logger.info(f"Mode: {'DEBUG' if debug_mode else 'PRODUCTION'}")
    logger.info("Listening on http://0.0.0.0:5000")

    app.run(host="0.0.0.0", port=5000, debug=debug_mode)
