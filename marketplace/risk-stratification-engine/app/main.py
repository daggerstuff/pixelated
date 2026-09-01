"""FastAPI application for the Risk Stratification service.

Exposes endpoints for health checks and risk stratification assessment.
Follows the same dependency injection pattern as note_drafting.main.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException

from .config import RiskStratificationSettings
from .models import (
    HealthResponse,
    RiskStratificationRequest,
    RiskStratificationResponse,
)
from .service import RiskStratificationService

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: configure logging on startup."""
    logging.basicConfig(level=logging.INFO)
    logger.info("Risk Stratification service starting")
    yield
    logger.info("Risk Stratification service shutting down")


app = FastAPI(
    title="EHR Risk Stratification Service",
    description=(
        "Clinical risk stratification service that accepts PHQ-9, GAD-7, "
        "and C-SSRS scores with clinical note context, returning a risk "
        "level (low/medium/high/crisis) with recommended actions."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


def get_settings() -> RiskStratificationSettings:
    """Dependency: provide settings instance."""
    return RiskStratificationSettings()


def get_service(
    settings: Annotated[RiskStratificationSettings, Depends(get_settings)],
) -> RiskStratificationService:
    """Dependency: provide service instance configured with settings."""
    return RiskStratificationService(settings)


def verify_baa_gate(
    settings: Annotated[RiskStratificationSettings, Depends(get_settings)],
) -> None:
    """Dependency: enforce BAA requirement before PHI processing (Gate G2.3).

    Raises:
        HTTPException: 403 if BAA is not confirmed.
    """
    if not settings.baa_confirmed:
        raise HTTPException(
            status_code=403,
            detail="BAA not confirmed. Risk stratification requires a "
            "Business Associate Agreement before processing PHI.",
        )


@app.get("/health", response_model=HealthResponse)
async def health(
    settings: Annotated[RiskStratificationSettings, Depends(get_settings)],
) -> HealthResponse:
    """Health check endpoint — does not require BAA."""
    service = RiskStratificationService(settings)
    return HealthResponse(
        status="ok",
        service="risk-stratification",
        baa_confirmed=settings.baa_confirmed,
        nim_configured=service.is_nim_configured,
    )


@app.post("/stratify", response_model=RiskStratificationResponse)
async def stratify(
    request: RiskStratificationRequest,
    _baa: Annotated[None, Depends(verify_baa_gate)],
    service: Annotated[RiskStratificationService, Depends(get_service)],
) -> RiskStratificationResponse:
    """Run risk stratification on assessment scores.

    Accepts PHQ-9, GAD-7, C-SSRS scores and clinical note context.
    Returns a risk level with recommended actions and audit trail ID.
    Requires BAA confirmation (Gate G2.3) before processing any PHI.
    """
    try:
        return await service.stratify_risk(request)
    except Exception as exc:
        logger.error("Risk stratification failed: %s", str(exc))
        raise HTTPException(
            status_code=502,
            detail=f"Risk stratification service error: {type(exc).__name__}",
        ) from exc


def main() -> None:
    """Entry point for the ``risk-stratification`` console script.

    Runs the FastAPI app with uvicorn using the package module path.
    """
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
    )


if __name__ == "__main__":
    main()
