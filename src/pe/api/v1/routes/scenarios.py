"""Scenario management API endpoints.

Implements:
- List scenarios (filterable by clinical focus, difficulty)
- Get scenario by ID (with persona config)
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.pe.core.dependencies import get_rls_session
from src.pe.core.rbac import UserRole, role_at_least

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


class ScenarioResponse(BaseModel):
    id: str
    title: str
    description: str | None = None
    clinical_focus: str | None = None
    difficulty_level: str
    expected_duration_minutes: int | None = None
    persona_config: list[Any] = []
    is_published: bool = False
    version: int = 1
    created_at: str


class ScenarioDetailResponse(ScenarioResponse):
    accuracy_rules: dict[str, Any] | None = None
    accuracy_pass_threshold: float | None = None
    updated_at: str


@router.get("", response_model=list[ScenarioResponse])
async def list_scenarios(
    clinical_focus: str | None = None,
    difficulty: str | None = None,
    published_only: bool = True,
    session: AsyncSession = Depends(get_rls_session),
    current_user: dict = Depends(role_at_least(UserRole.LEARNER)),
):
    """List scenarios available to the current tenant.

    Learners see only published scenarios. Educators+ see all.
    """
    tenant_id = current_user["tenant_id"]
    role = current_user["role"]

    # Learners see published scenarios from their own tenant + global published
    # Educators+ see all scenarios from their tenant
    if role == "learner" and published_only:
        where_clause = """
            (institution_id = :tenant_id OR institution_id IS NULL)
            AND is_published = TRUE
        """
    else:
        where_clause = """
            (institution_id = :tenant_id OR institution_id IS NULL)
        """

    params: dict[str, Any] = {"tenant_id": tenant_id}

    if clinical_focus:
        where_clause += " AND clinical_focus = :focus"
        params["focus"] = clinical_focus

    if difficulty:
        where_clause += " AND difficulty_level = :difficulty"
        params["difficulty"] = difficulty

    result = await session.execute(
        text(f"""
            SELECT id, title, description, clinical_focus, difficulty_level,
                   expected_duration_minutes, persona_config, is_published, version, created_at
            FROM pe.scenarios
            WHERE {where_clause}
            ORDER BY is_published DESC, created_at DESC
            LIMIT 50
        """),
        params,
    )
    rows = result.fetchall()

    return [
        ScenarioResponse(
            id=str(r[0]),
            title=r[1],
            description=r[2],
            clinical_focus=r[3],
            difficulty_level=r[4],
            expected_duration_minutes=r[5],
            persona_config=r[6] if r[6] else [],
            is_published=r[7],
            version=r[8],
            created_at=str(r[9]),
        )
        for r in rows
    ]


@router.get("/{scenario_id}", response_model=ScenarioDetailResponse)
async def get_scenario(
    scenario_id: str,
    session: AsyncSession = Depends(get_rls_session),
    current_user: dict = Depends(role_at_least(UserRole.LEARNER)),
):
    """Get detailed information about a specific scenario."""
    result = await session.execute(
        text("""
            SELECT id, title, description, clinical_focus, difficulty_level,
                   expected_duration_minutes, persona_config, accuracy_rules,
                   accuracy_pass_threshold, is_published, version, created_at, updated_at
            FROM pe.scenarios
            WHERE id = :id AND (institution_id = :tenant_id OR institution_id IS NULL)
        """),
        {"id": scenario_id, "tenant_id": current_user["tenant_id"]},
    )
    scenario = result.fetchone()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    return ScenarioDetailResponse(
        id=str(scenario[0]),
        title=scenario[1],
        description=scenario[2],
        clinical_focus=scenario[3],
        difficulty_level=scenario[4],
        expected_duration_minutes=scenario[5],
        persona_config=scenario[6] if scenario[6] else [],
        accuracy_rules=scenario[7],
        accuracy_pass_threshold=float(scenario[8]) if scenario[8] else None,
        is_published=scenario[9],
        version=scenario[10],
        created_at=str(scenario[11]),
        updated_at=str(scenario[12]),
    )
