"""Simulation session management API and WebSocket endpoint.

Implements:
- CRUD for simulation sessions (create, start, pause, resume, abort)
- WebSocket endpoint for live simulation interaction
- Wires to Celery orchestration chain
- Session state persistence
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.pe.core.dependencies import get_rls_session
from src.pe.core.rbac import UserRole, role_at_least
from src.pe.core.security import decode_access_token
from src.pe.database import async_session_factory

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/simulations", tags=["simulations"])

# Pre-bound role checkers (B008-compliant - factory called once at import, not at function definition)
_educator_required = role_at_least(UserRole.EDUCATOR)
_learner_required = role_at_least(UserRole.LEARNER)
_admin_required = role_at_least(UserRole.INSTITUTION_ADMIN)


# ── Schemas ───────────────────────────────────────────────────────


class CreateSimulationRequest(BaseModel):
    scenario_id: str = Field(..., description="UUID of the scenario to simulate")
    learner_id: str | None = Field(None, description="Learner user ID (defaults to current user)")


class SimulationResponse(BaseModel):
    id: str
    scenario_id: str
    learner_id: str
    educator_id: str | None = None
    status: str
    started_at: str | None = None
    completed_at: str | None = None
    accuracy_score: float | None = None
    safety_violations: int = 0
    created_at: str


class SimulationStateUpdate(BaseModel):
    status: str | None = Field(None, pattern="^(pending|active|paused|completed|aborted)$")
    session_context: dict[str, Any] | None = None


# ── WebSocket Connection Manager ──────────────────────────────────


class ConnectionManager:
    """Manages active WebSocket connections per session."""

    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}

    async def connect(self, session_id: str, ws: WebSocket) -> None:
        await ws.accept()
        if session_id not in self._connections:
            self._connections[session_id] = set()
        self._connections[session_id].add(ws)

    def disconnect(self, session_id: str, ws: WebSocket) -> None:
        if session_id in self._connections:
            self._connections[session_id].discard(ws)
            if not self._connections[session_id]:
                del self._connections[session_id]

    async def broadcast(self, session_id: str, message: dict[str, Any]) -> None:
        """Broadcast a ServerMessage to all connected clients for this session."""
        if session_id not in self._connections:
            return
        payload = json.dumps(message, default=str)
        stale = set()
        for ws in self._connections[session_id]:
            try:
                await ws.send_text(payload)
            except WebSocketDisconnect:
                stale.add(ws)
        for ws in stale:
            self._connections[session_id].discard(ws)


manager = ConnectionManager()


# ── Celery Integration (async stub) ───────────────────────────────


async def trigger_celery_chain(
    _session_id: str,
    _user_input: str,
    _tenant_id: str,
    _user_id: str,
) -> str | None:
    """Trigger the Celery orchestration chain.

    In production this would call:
        chain(
            run_safety_input_guard.s(user_input),
            update_persona_state.s(),
            generate_llm_response.s(),
            run_safety_output_guard.s(),
            broadcast_response.s(session_id)
        ).apply_async()

    Returns a task_id for polling, or None if Celery is unavailable.
    """
    # Stub: For now, simulate a synchronous response for testing
    # In production, this calls celery_app.send_task(...)
    return None


# ── Simulation CRUD Endpoints ─────────────────────────────────────


@router.post("", response_model=SimulationResponse, status_code=status.HTTP_201_CREATED)
async def create_simulation(
    request: CreateSimulationRequest,
    session: Annotated[AsyncSession, Depends(get_rls_session)],
    current_user: Annotated[dict, Depends(_educator_required)],
):
    """Create a new simulation session.

    Initializes the session with pending status, creates persona instances
    from the scenario config, and returns the session details.
    """
    tenant_id = current_user["tenant_id"]
    educator_id = current_user["user_id"]
    learner_id = request.learner_id or educator_id

    # Verify scenario exists and belongs to tenant
    result = await session.execute(
        text("""
            SELECT id, persona_config FROM pe.scenarios
            WHERE id = :scenario_id AND (institution_id = :tenant_id OR is_published = TRUE)
        """),
        {"scenario_id": request.scenario_id, "tenant_id": tenant_id},
    )
    scenario = result.fetchone()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    scenario_id = str(scenario[0])
    persona_config = scenario[1] or []

    # Create the simulation session
    sim_id = str(uuid.uuid4())
    await session.execute(
        text("""
            INSERT INTO pe.simulation_sessions
                (id, institution_id, scenario_id, educator_id, learner_id, status)
            VALUES (:id, :tenant_id, :scenario_id, :educator_id, :learner_id, 'pending')
        """),
        {
            "id": sim_id,
            "tenant_id": tenant_id,
            "scenario_id": scenario_id,
            "educator_id": educator_id,
            "learner_id": learner_id,
        },
    )

    # Create persona instances for each persona in the config
    persona_params = []
    for _i, persona_ref in enumerate(persona_config):
        persona_def_id = persona_ref.get("persona_definition_id") if isinstance(persona_ref, dict) else persona_ref
        if persona_def_id:
            persona_params.append(
                {
                    "session_id": sim_id,
                    "persona_def_id": persona_def_id,
                    "tenant_id": tenant_id,
                }
            )

    if persona_params:
        await session.execute(
            text("""
                INSERT INTO pe.persona_instances
                    (session_id, persona_definition_id, institution_id, current_state,
                     conversation_history, turn_count, tokens_consumed)
                VALUES (:session_id, :persona_def_id, :tenant_id, '{}', '[]', 0, 0)
            """),
            persona_params,
        )

    # Fetch the created session
    result = await session.execute(
        text("""
            SELECT id, scenario_id, learner_id, educator_id, status,
                   started_at, completed_at, accuracy_score, safety_violations, created_at
            FROM pe.simulation_sessions WHERE id = :id
        """),
        {"id": sim_id},
    )
    sim = result.fetchone()
    assert sim is not None

    return SimulationResponse(
        id=str(sim[0]),
        scenario_id=str(sim[1]),
        learner_id=str(sim[2]),
        educator_id=str(sim[3]) if sim[3] else None,
        status=sim[4],
        started_at=str(sim[5]) if sim[5] else None,
        completed_at=str(sim[6]) if sim[6] else None,
        accuracy_score=float(sim[7]) if sim[7] else None,
        safety_violations=sim[8] or 0,
        created_at=str(sim[9]),
    )


@router.get("", response_model=list[SimulationResponse])
async def list_simulations(
    session: Annotated[AsyncSession, Depends(get_rls_session)],
    current_user: Annotated[dict, Depends(_learner_required)],
    status_filter: str | None = None,
):
    """List simulation sessions for the current tenant.

    Learners see only their own sessions. Educators+ see all.
    """
    tenant_id = current_user["tenant_id"]
    user_id = current_user["user_id"]
    role = current_user["role"]

    where_clause = "institution_id = :tenant_id"
    params: dict[str, Any] = {"tenant_id": tenant_id}

    if role == "learner":
        where_clause += " AND (learner_id = :user_id OR educator_id = :user_id)"
        params["user_id"] = user_id

    if status_filter:
        where_clause += " AND status = :status"
        params["status"] = status_filter

    result = await session.execute(
        text(f"""
            SELECT id, scenario_id, learner_id, educator_id, status,
                   started_at, completed_at, accuracy_score, safety_violations, created_at
            FROM pe.simulation_sessions
            WHERE {where_clause}
            ORDER BY created_at DESC
            LIMIT 50
        """),
        params,
    )
    rows = result.fetchall()

    return [
        SimulationResponse(
            id=str(r[0]),
            scenario_id=str(r[1]),
            learner_id=str(r[2]),
            educator_id=str(r[3]) if r[3] else None,
            status=r[4],
            started_at=str(r[5]) if r[5] else None,
            completed_at=str(r[6]) if r[6] else None,
            accuracy_score=float(r[7]) if r[7] else None,
            safety_violations=r[8] or 0,
            created_at=str(r[9]),
        )
        for r in rows
    ]


@router.get("/{sim_id}", response_model=SimulationResponse)
async def get_simulation(
    sim_id: str,
    session: Annotated[AsyncSession, Depends(get_rls_session)],
    current_user: Annotated[dict, Depends(_learner_required)],
):
    """Get details of a specific simulation session."""
    result = await session.execute(
        text("""
            SELECT id, scenario_id, learner_id, educator_id, status,
                   started_at, completed_at, accuracy_score, safety_violations, created_at
            FROM pe.simulation_sessions
            WHERE id = :id AND institution_id = :tenant_id
        """),
        {"id": sim_id, "tenant_id": current_user["tenant_id"]},
    )
    sim = result.fetchone()
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    return SimulationResponse(
        id=str(sim[0]),
        scenario_id=str(sim[1]),
        learner_id=str(sim[2]),
        educator_id=str(sim[3]) if sim[3] else None,
        status=sim[4],
        started_at=str(sim[5]) if sim[5] else None,
        completed_at=str(sim[6]) if sim[6] else None,
        accuracy_score=float(sim[7]) if sim[7] else None,
        safety_violations=sim[8] or 0,
        created_at=str(sim[9]),
    )


@router.post("/{sim_id}/start", response_model=SimulationResponse)
async def start_simulation(
    sim_id: str,
    session: Annotated[AsyncSession, Depends(get_rls_session)],
    current_user: Annotated[dict, Depends(_educator_required)],
):
    """Start a pending simulation session."""
    result = await session.execute(
        text("""
            UPDATE pe.simulation_sessions
            SET status = 'active', started_at = NOW()
            WHERE id = :id AND institution_id = :tenant_id AND status = 'pending'
            RETURNING id, scenario_id, learner_id, educator_id, status,
                      started_at, completed_at, accuracy_score, safety_violations, created_at
        """),
        {"id": sim_id, "tenant_id": current_user["tenant_id"]},
    )
    sim = result.fetchone()
    if not sim:
        raise HTTPException(status_code=400, detail="Simulation not found or not in 'pending' status")

    return SimulationResponse(
        id=str(sim[0]),
        scenario_id=str(sim[1]),
        learner_id=str(sim[2]),
        educator_id=str(sim[3]) if sim[3] else None,
        status=sim[4],
        started_at=str(sim[5]) if sim[5] else None,
        completed_at=str(sim[6]) if sim[6] else None,
        accuracy_score=float(sim[7]) if sim[7] else None,
        safety_violations=sim[8] or 0,
        created_at=str(sim[9]),
    )


@router.post("/{sim_id}/pause", response_model=SimulationResponse)
async def pause_simulation(
    sim_id: str,
    session: Annotated[AsyncSession, Depends(get_rls_session)],
    current_user: Annotated[dict, Depends(_educator_required)],
):
    """Pause an active simulation."""
    result = await session.execute(
        text("""
            UPDATE pe.simulation_sessions
            SET status = 'paused', paused_at = NOW()
            WHERE id = :id AND institution_id = :tenant_id AND status = 'active'
            RETURNING id, scenario_id, learner_id, educator_id, status,
                      started_at, completed_at, accuracy_score, safety_violations, created_at
        """),
        {"id": sim_id, "tenant_id": current_user["tenant_id"]},
    )
    sim = result.fetchone()
    if not sim:
        raise HTTPException(status_code=400, detail="Simulation not found or not 'active'")

    return SimulationResponse(
        id=str(sim[0]),
        scenario_id=str(sim[1]),
        learner_id=str(sim[2]),
        educator_id=str(sim[3]) if sim[3] else None,
        status=sim[4],
        started_at=str(sim[5]) if sim[5] else None,
        completed_at=str(sim[6]) if sim[6] else None,
        accuracy_score=float(sim[7]) if sim[7] else None,
        safety_violations=sim[8] or 0,
        created_at=str(sim[9]),
    )


@router.post("/{sim_id}/resume", response_model=SimulationResponse)
async def resume_simulation(
    sim_id: str,
    session: Annotated[AsyncSession, Depends(get_rls_session)],
    current_user: Annotated[dict, Depends(_educator_required)],
):
    """Resume a paused simulation, accounting for elapsed pause time."""
    # Calculate and accumulate pause duration
    result = await session.execute(
        text("""
            UPDATE pe.simulation_sessions
            SET status = 'active',
                total_pause_seconds = total_pause_seconds +
                    COALESCE(EXTRACT(EPOCH FROM (NOW() - paused_at)), 0)::INTEGER,
                paused_at = NULL
            WHERE id = :id AND institution_id = :tenant_id AND status = 'paused'
            RETURNING id, scenario_id, learner_id, educator_id, status,
                      started_at, completed_at, accuracy_score, safety_violations, created_at
        """),
        {"id": sim_id, "tenant_id": current_user["tenant_id"]},
    )
    sim = result.fetchone()
    if not sim:
        raise HTTPException(status_code=400, detail="Simulation not found or not 'paused'")

    return SimulationResponse(
        id=str(sim[0]),
        scenario_id=str(sim[1]),
        learner_id=str(sim[2]),
        educator_id=str(sim[3]) if sim[3] else None,
        status=sim[4],
        started_at=str(sim[5]) if sim[5] else None,
        completed_at=str(sim[6]) if sim[6] else None,
        accuracy_score=float(sim[7]) if sim[7] else None,
        safety_violations=sim[8] or 0,
        created_at=str(sim[9]),
    )


@router.post("/{sim_id}/abort", response_model=SimulationResponse)
async def abort_simulation(
    sim_id: str,
    session: Annotated[AsyncSession, Depends(get_rls_session)],
    current_user: Annotated[dict, Depends(_admin_required)],
):
    """Abort a simulation (admin only — terminates any status except completed)."""
    result = await session.execute(
        text("""
            UPDATE pe.simulation_sessions
            SET status = 'aborted', completed_at = NOW()
            WHERE id = :id AND institution_id = :tenant_id AND status NOT IN ('completed', 'archived')
            RETURNING id, scenario_id, learner_id, educator_id, status,
                      started_at, completed_at, accuracy_score, safety_violations, created_at
        """),
        {"id": sim_id, "tenant_id": current_user["tenant_id"]},
    )
    sim = result.fetchone()
    if not sim:
        raise HTTPException(status_code=400, detail="Simulation not found or already completed")

    return SimulationResponse(
        id=str(sim[0]),
        scenario_id=str(sim[1]),
        learner_id=str(sim[2]),
        educator_id=str(sim[3]) if sim[3] else None,
        status=sim[4],
        started_at=str(sim[5]) if sim[5] else None,
        completed_at=str(sim[6]) if sim[6] else None,
        accuracy_score=float(sim[7]) if sim[7] else None,
        safety_violations=sim[8] or 0,
        created_at=str(sim[9]),
    )


# ── WebSocket Endpoint ─────────────────────────────────────────────


@router.websocket("/ws/{session_id}")
async def simulation_websocket(  # noqa: PLR0912, PLR0915
    ws: WebSocket,
    session_id: str,
    token: str | None = None,
):
    """WebSocket endpoint for live simulation interaction.

    Connection: wss://host/api/v1/simulations/ws/{session_id}?token={jwt}

    Client sends ClientMessage:
        { type: "chat_message" | "decision_response" | "pause" | "resume" | "end",
          payload: { text?, decision_id?, option_id? },
          client_timestamp: "ISO-8601" }

    Server sends ServerMessage:
        { type: "message" | "state_update" | "decision_prompt" | "vitals_update"
              | "simulation_end" | "error",
          payload: { message?, state?, vitals?, decision?, results_url?, error? } }
    """
    # Validate token
    if token:
        payload = decode_access_token(token)
        if payload is None:
            await ws.close(code=4001, reason="Invalid or expired token")
            return
        tenant_id = payload.get("tenant_id")
        user_id = payload.get("sub")
        user_role = payload.get("role", "learner")
    else:
        await ws.close(code=4001, reason="Missing authentication token")
        return

    # Verify session_id belongs to the user's tenant
    async with async_session_factory() as verify_session:
        result = await verify_session.execute(
            text("SELECT id FROM pe.simulation_sessions WHERE id = :sid AND institution_id = :tid"),
            {"sid": session_id, "tid": tenant_id},
        )
        if not result.fetchone():
            await ws.close(code=4003, reason="Session not found or access denied")
            return

    await manager.connect(session_id, ws)

    try:
        while True:
            data = await ws.receive_text()
            client_msg = json.loads(data)
            msg_type = client_msg.get("type")
            msg_payload = client_msg.get("payload", {})

            if msg_type == "chat_message":
                user_text = msg_payload.get("text", "")

                # Save the learner's message
                async with async_session_factory() as db_session:
                    await db_session.execute(
                        text("SELECT pe.set_session_context(:tid, :uid, :role)"),
                        {"tid": tenant_id, "uid": user_id, "role": user_role},
                    )
                    await db_session.execute(
                        text("""
                            INSERT INTO pe.simulation_messages
                                (session_id, institution_id, actor_type, actor_id,
                                 message_text, turn_number)
                            SELECT :session_id, :tenant_id, 'learner', :user_id,
                                   :text,
                                   COALESCE(MAX(turn_number), 0) + 1
                            FROM pe.simulation_messages WHERE session_id = :session_id2
                        """),
                        {
                            "session_id": session_id,
                            "tenant_id": tenant_id,
                            "user_id": user_id,
                            "text": user_text,
                            "session_id2": session_id,
                        },
                    )
                    await db_session.commit()

                # Trigger Celery chain (async)
                assert tenant_id is not None
                assert user_id is not None
                task_id = await trigger_celery_chain(  # type: ignore
                    session_id, user_text, tenant_id, user_id
                )

                # If no Celery, echo back a stub response
                if task_id is None:
                    turn_num = 0
                    async with async_session_factory() as db_session:
                        result = await db_session.execute(
                            text("SELECT COUNT(*) FROM pe.simulation_messages WHERE session_id = :sid"),
                            {"sid": session_id},
                        )
                        turn_num = result.scalar() or 1

                    # Simulated persona response
                    response_msg = {
                        "type": "message",
                        "payload": {
                            "message": {
                                "id": str(uuid.uuid4()),
                                "role": "persona",
                                "content": f"I understand you're asking about '{user_text[:50]}'. Let me help you with that. As a patient, I can tell you about my symptoms and medical history.",
                                "turn_number": turn_num + 1,
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            },
                            "state": {
                                "current": "assessment",
                                "variables": {"last_question": user_text[:100]},
                            },
                        },
                    }
                    await manager.broadcast(session_id, response_msg)

            elif msg_type == "pause":
                async with async_session_factory() as db_session:
                    await db_session.execute(
                        text("SELECT pe.set_session_context(:tid, :uid, :role)"),
                        {"tid": tenant_id, "uid": user_id, "role": user_role},
                    )
                    await db_session.execute(
                        text("""
                            UPDATE pe.simulation_sessions
                            SET status = 'paused', paused_at = NOW()
                            WHERE id = :id AND status = 'active'
                        """),
                        {"id": session_id},
                    )
                    await db_session.commit()
                await manager.broadcast(
                    session_id,
                    {
                        "type": "state_update",
                        "payload": {"state": {"current": "paused"}},
                    },
                )

            elif msg_type == "resume":
                async with async_session_factory() as db_session:
                    await db_session.execute(
                        text("SELECT pe.set_session_context(:tid, :uid, :role)"),
                        {"tid": tenant_id, "uid": user_id, "role": user_role},
                    )
                    await db_session.execute(
                        text("""
                            UPDATE pe.simulation_sessions
                            SET status = 'active',
                                total_pause_seconds = total_pause_seconds +
                                    COALESCE(EXTRACT(EPOCH FROM (NOW() - paused_at)), 0)::INTEGER,
                                paused_at = NULL
                            WHERE id = :id AND status = 'paused'
                        """),
                        {"id": session_id},
                    )
                    await db_session.commit()
                await manager.broadcast(
                    session_id,
                    {
                        "type": "state_update",
                        "payload": {"state": {"current": "active"}},
                    },
                )

            elif msg_type == "end":
                async with async_session_factory() as db_session:
                    await db_session.execute(
                        text("SELECT pe.set_session_context(:tid, :uid, :role)"),
                        {"tid": tenant_id, "uid": user_id, "role": user_role},
                    )
                    await db_session.execute(
                        text("""
                            UPDATE pe.simulation_sessions
                            SET status = 'completed', completed_at = NOW()
                            WHERE id = :id AND status IN ('active', 'paused')
                        """),
                        {"id": session_id},
                    )
                    await db_session.commit()
                await manager.broadcast(
                    session_id,
                    {
                        "type": "simulation_end",
                        "payload": {"reason": "user_ended"},
                    },
                )
                break

            elif msg_type == "decision_response":
                # Handle clinical decision responses
                decision_id = msg_payload.get("decision_id")
                option_id = msg_payload.get("option_id")
                await manager.broadcast(
                    session_id,
                    {
                        "type": "state_update",
                        "payload": {
                            "state": {
                                "current": "assessment",
                                "variables": {
                                    "decision_id": decision_id,
                                    "selected_option": option_id,
                                },
                            },
                        },
                    },
                )

    except WebSocketDisconnect:
        pass
    except (RuntimeError, OSError) as exc:
        logger.error("websocket_error", session_id=session_id, error=str(exc))
        await manager.broadcast(
            session_id,
            {
                "type": "error",
                "payload": {"error": "Internal server error"},
            },
        )
    finally:
        manager.disconnect(session_id, ws)
