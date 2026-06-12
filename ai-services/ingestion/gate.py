"""PIX-3894: async FastAPI ingestion gate controller.

Provides a lightweight HTTP endpoint for content ingestion through the
5-gate memory evaluation pipeline (PII, crisis, trauma, consent, review).
"""

from __future__ import annotations

import logging
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# Ensure the repo root is on sys.path so we can import the ai package.
_repo_root = Path(__file__).resolve().parent.parent.parent
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))

from ai.memory.gates import GateDecision, GateResult, GatingReport  # noqa: E402
from ai.memory.gates.consent_gate import ConsentGateChecker  # noqa: E402
from ai.memory.gates.crisis_detector import CrisisDetector  # noqa: E402
from ai.memory.gates.pii_redactor import PiiRedactor  # noqa: E402
from ai.memory.gates.trauma_filter import TraumaFilter  # noqa: E402

logger = logging.getLogger(__name__)

# ─── Pydantic models ──────────────────────────────────────────────────────────


class IngestRequest(BaseModel):
    """Request to ingest a memory block through the gating pipeline."""

    content: str = Field(..., min_length=1, description="Memory content to ingest")
    source_id: str = Field(..., description="Source identifier")
    user_id: str | None = Field(None, description="Optional user identifier for consent checks")


class IngestResponse(BaseModel):
    """Result of the ingestion gating pipeline."""

    accepted: bool
    report: dict[str, Any]
    request_id: str


# ─── Mock protocol adapter ─────────────────────────────────────────────────────
# Real provider integration will be wired once the upstream dependencies settle.
# For now the gate service creates its own gate instances and maintains no
# external connection state.


class _IngestionMockProtocol:
    """Adapter isolating ingestion orchestration from real provider integration.

    Each gate is instantiated fresh at startup. Consent state is in-memory
    (ephemeral) and will be replaced with persistent storage in a follow-up.
    """

    def __init__(self) -> None:
        self.pii = PiiRedactor()
        self.crisis = CrisisDetector()
        self.trauma = TraumaFilter()
        self.consent = ConsentGateChecker()

    def evaluate_all(self, content: str, source_id: str, user_id: str | None) -> GatingReport:
        """Run all 5 gates in sequence and return the aggregated report."""
        report = GatingReport(source_id=source_id, content=content)

        # Gate 0 — PII Redaction
        report.gate0_pii = self.pii.evaluate(content)

        # Gate 1 — Crisis Detection
        report.gate1_crisis = self.crisis.evaluate(content)
        if report.gate1_crisis.decision == GateDecision.BLOCK:
            return report  # Short-circuit on critical crisis

        # Gate 2 — Trauma-Trigger Filtering
        report.gate2_trauma = self.trauma.evaluate(content, user_id=user_id)

        # Gate 3 — Consent-Gated Retrieval
        if user_id:
            report.gate3_consent = self.consent.evaluate(user_id=user_id)

        # Gate 4 — Review Queue (pass-through; real escalation handled by review_queue_api)
        report.gate4_review = GateResult(
            gate="gate4_review",
            decision=GateDecision.PASS,
            reason="Review gate deferred to HumanReviewQueue",
            confidence=1.0,
        )

        # Populate summary fields for convenience
        if report.gate0_pii and report.gate0_pii.details:
            report.pii_types_found = [d for d in report.gate0_pii.details if d != "none"]
        if report.gate1_crisis:
            for detail in report.gate1_crisis.details:
                if detail.startswith("tier:"):
                    report.crisis_tier = detail.split(":", 1)[1].strip()
        if report.gate2_trauma:
            report.trauma_indicators = report.gate2_trauma.details

        return report


# ─── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Memory Ingestion Gate",
    description="PIX-3894: Async FastAPI ingestion gate controller for the 5-gate pipeline",
    version="1.0.0",
)

protocol = _IngestionMockProtocol()


@app.on_event("startup")
async def startup_event() -> None:
    """Log startup and warm up the gate instances."""
    logger.info(
        "Ingestion gate service starting — gates: pii=%s, crisis=%s, trauma=%s, consent=%s",
        protocol.pii is not None,
        protocol.crisis is not None,
        protocol.trauma is not None,
        protocol.consent is not None,
    )


@app.get("/health")
async def health() -> dict[str, Any]:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "ingestion-gate",
        "version": "1.0.0",
        "timestamp": datetime.now(UTC).isoformat(),
    }


@app.post("/ingest", response_model=IngestResponse)
async def ingest(request: IngestRequest) -> IngestResponse:
    """Evaluate a memory block through the 5-gate ingestion pipeline.

    Args:
        request: The content and metadata to evaluate.

    Returns:
        IngestResponse with the gate decisions and whether the content
        is accepted for ingestion.
    """
    request_id = uuid.uuid4().hex[:12]

    try:
        report = protocol.evaluate_all(
            content=request.content,
            source_id=request.source_id,
            user_id=request.user_id,
        )
    except Exception as exc:
        logger.exception("Gating pipeline failed for source_id=%s", request.source_id)
        raise HTTPException(status_code=500, detail=f"Gating pipeline error: {exc}") from exc

    accepted = report.passed

    if not accepted:
        logger.info(
            "Ingestion blocked: source_id=%s request_id=%s blocked=%s needs_review=%s",
            request.source_id,
            request_id,
            report.blocked,
            report.needs_review,
        )

    return IngestResponse(
        accepted=accepted,
        report=report.to_dict(),
        request_id=request_id,
    )
