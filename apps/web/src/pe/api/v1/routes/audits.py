"""Quadit audit API — runs the adversarial quad-audit over submitted content.

POST /api/v1/audits — educator+ only. Accepts content items and an audit
mode ("deterministic" pattern scan, or "llm" for full judge prompts) and
returns the complete quad-audit report (three clinical judges plus the
adversarial auditor personas).

The endpoint is stateless: it does not persist content or reports. It is
used by the admin audit UI and by QA tooling; persistence is follow-up work
if the UI needs report history.
"""

from __future__ import annotations

from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ai.research.quadit import AuditItem, QuadAuditReport
from src.pe.core.dependencies import get_current_user
from src.pe.core.quadit import audit_content
from src.pe.core.rbac import UserRole, role_at_least

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/audits", tags=["audits"])

# Pre-bound role checker (B008-compliant — factory called once at import)
_educator_gate = role_at_least(UserRole.EDUCATOR)


async def _educator_current_user(
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    """Resolve the JWT user, then enforce the educator role gate.

    The bare ``current_user`` parameter inside ``role_at_least`` checkers
    only resolves when ``get_current_user`` is elsewhere in the dependency
    tree — chaining it explicitly keeps this stateless route self-contained.
    """
    gated: dict[str, Any] = await _educator_gate(user)
    return gated


MAX_ITEMS_PER_AUDIT = 50
MAX_ITEM_CONTENT_CHARS = 8_000


class AuditItemIn(BaseModel):
    """One piece of content submitted for auditing."""

    id: str = Field(..., min_length=1, description="Stable identifier for this item.")
    kind: str = Field(default="ai_response", description="Content kind, e.g. 'ai_response'.")
    author_role: str = Field(default="", description="Who produced the item.")
    content: str = Field(..., min_length=1, description="The content text to audit.")
    context: dict[str, str] = Field(default_factory=dict, description="Adapter metadata.")


class AuditRequest(BaseModel):
    """Request body for POST /api/v1/audits."""

    items: list[AuditItemIn] = Field(..., min_length=1, max_length=MAX_ITEMS_PER_AUDIT)
    mode: str = Field(
        default="deterministic",
        pattern="^(deterministic|llm)$",
        description="'deterministic' for pattern scans, 'llm' for full judge prompts.",
    )
    auditors: list[str] = Field(
        default=["brene_brown"],
        min_length=0,
        description="Adversarial auditor persona names (TOML descriptors shipped with quadit).",
    )


def _to_audit_items(items: list[AuditItemIn]) -> list[AuditItem]:
    """Convert request items to core AuditItems, enforcing the size cap."""
    converted: list[AuditItem] = []
    for item in items:
        if len(item.content) > MAX_ITEM_CONTENT_CHARS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Item {item.id!r} exceeds {MAX_ITEM_CONTENT_CHARS} character limit.",
            )
        converted.append(
            AuditItem(
                id=item.id,
                kind=item.kind,
                author_role=item.author_role,
                content=item.content,
                context=item.context,
            )
        )
    return converted


@router.post("", response_model=QuadAuditReport, status_code=status.HTTP_200_OK)
async def run_audit(
    request: AuditRequest,
    current_user: Annotated[dict[str, Any], Depends(_educator_current_user)],
) -> QuadAuditReport:
    """Run the quadit audit over the submitted items."""
    items = _to_audit_items(request.items)
    try:
        report: QuadAuditReport = audit_content(items, mode=request.mode, auditors=tuple(request.auditors))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    logger.info(
        "quadit_audit_completed",
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"],
        passed=report.passed,
        item_count=report.item_count,
        mode=report.mode,
        critical_count=report.critical_count,
    )
    return report
