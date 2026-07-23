import json
import os
from datetime import datetime

import asyncpg
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Pixelated Python Backend")

API_VERSION = 1


@app.middleware("http")
async def add_version_header(request, call_next):
    """Add X-API-Version header to all /api/ responses."""
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["X-API-Version"] = str(API_VERSION)
    return response


async def get_db_connection():
    db_url = os.environ.get("DATABASE_URL", "postgresql://vivi@localhost/pixelated")
    return await asyncpg.connect(db_url)


class EvaluationFeedback(BaseModel):
    sessionId: str
    feedback: dict | str


@app.get("/api/evaluation")
async def get_evaluations(sessionId: str):
    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            """
            SELECT id, session_id as "sessionId", feedback, created_at as "createdAt"
            FROM evaluations
            WHERE session_id = $1
            ORDER BY created_at DESC
        """,
            sessionId,
        )

        evaluations = []
        for row in rows:
            evaluations.append(
                {
                    "id": str(row["id"]),
                    "sessionId": row["sessionId"],
                    "feedback": row["feedback"],
                    "createdAt": row["createdAt"].isoformat()
                    if hasattr(row["createdAt"], "isoformat")
                    else row["createdAt"],
                }
            )
        return {"sessionId": sessionId, "evaluations": evaluations}
    finally:
        await conn.close()


@app.post("/api/evaluation")
async def post_evaluation(data: EvaluationFeedback):
    conn = await get_db_connection()
    try:
        feedback_val = data.feedback if isinstance(data.feedback, str) else json.dumps(data.feedback)
        row = await conn.fetchrow(
            "INSERT INTO evaluations (session_id, feedback, created_at) VALUES ($1, $2, NOW()) RETURNING id",
            data.sessionId,
            feedback_val,
        )
        if not row:
            raise HTTPException(status_code=500, detail="Insert failed")
        eval_id = row["id"]

        session_update_json = json.dumps(
            {"feedback": data.feedback, "timestamp": datetime.now().isoformat(), "evaluator": "therapist"}
        )

        await conn.execute(
            """
            UPDATE sessions
            SET context = jsonb_set(
                COALESCE(context, '{}'::jsonb),
                '{latestEvaluation}',
                $1::jsonb
            ),
            updated_at = NOW()
            WHERE id = $2
        """,
            session_update_json,
            data.sessionId,
        )

        return {"success": True, "evaluationId": eval_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await conn.close()


# Memory endpoints proxy / extraction
class MemoryCreateInput(BaseModel):
    userId: str
    content: str
    metadata: dict = {}
    accountId: str = None
    workspaceId: str = None
    category: str = None


@app.post("/api/memory/create")
@app.post("/api/memory/add")
async def create_memory(data: MemoryCreateInput):
    import uuid

    return {
        "success": True,
        "memory_id": str(uuid.uuid4()),
        "memory": {
            "id": str(uuid.uuid4()),
            "content": data.content,
            "userId": data.userId,
            "sourceService": "foresight",
            "createdAt": datetime.now().isoformat(),
        },
    }


@app.post("/api/memory/search")
async def search_memory(data: dict):
    return {"success": True, "memories": [], "count": 0}


@app.get("/api/memory/stats/{user_id}")
async def get_memory_stats(user_id: str):
    return {"success": True, "totalMemories": 0, "categoryCounts": {}}


@app.get("/api/memory/all/{user_id}")
async def list_memories(user_id: str):
    return {"success": True, "memories": [], "count": 0}
