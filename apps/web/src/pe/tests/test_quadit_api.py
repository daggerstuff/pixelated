"""Tests for the quadit audit API endpoint and service adapter."""

from __future__ import annotations

from typing import Any

import pytest
from httpx import AsyncClient

from ai.research.quadit import AuditItem
from src.pe.core.quadit import ProviderQuaditClient, audit_content
from src.pe.core.security import create_access_token


def _make_token(role: str = "educator") -> str:
    return str(
        create_access_token(
            user_id="00000000-0000-0000-0000-000000000001",
            tenant_id="00000000-0000-0000-0000-000000000001",
            role=role,
        )
    )


def _auth_headers(role: str = "educator") -> dict[str, str]:
    return {"Authorization": f"Bearer {_make_token(role)}"}


def _item_payload(
    item_id: str = "r1",
    content: str = "We reviewed the session recording and adjusted the treatment plan.",
) -> dict[str, Any]:
    return {"id": item_id, "kind": "ai_response", "author_role": "pe-service", "content": content}


CLEAN_BODY: dict[str, Any] = {"items": [_item_payload()], "mode": "deterministic"}
PLATITUDE_CONTENT = "I'm here for you. It's ok to not be ok. Treat yourself kindly."


class TestAuditEndpoint:
    """Integration tests for POST /api/v1/audits."""

    @pytest.mark.asyncio
    async def test_audit_no_auth_is_401(self, client: AsyncClient) -> None:
        response = await client.post("/api/v1/audits", json=CLEAN_BODY)
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_audit_learner_forbidden(self, client: AsyncClient) -> None:
        response = await client.post("/api/v1/audits", json=CLEAN_BODY, headers=_auth_headers("learner"))
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_audit_clean_items_pass(self, client: AsyncClient) -> None:
        response = await client.post("/api/v1/audits", json=CLEAN_BODY, headers=_auth_headers())
        assert response.status_code == 200
        body = response.json()
        assert body["passed"] is True
        assert body["mode"] == "deterministic"
        assert len(body["verdicts"]) >= 3
        # The Brené Brown auditor runs by default
        personas = {v["persona"] for v in body["verdicts"]}
        assert "Brené Brown" in personas

    @pytest.mark.asyncio
    async def test_audit_platitude_flagged_with_warning(self, client: AsyncClient) -> None:
        body_json = {
            "items": [_item_payload("plat", PLATITUDE_CONTENT)],
            "mode": "deterministic",
        }
        response = await client.post("/api/v1/audits", json=body_json, headers=_auth_headers())
        assert response.status_code == 200
        body = response.json()
        brene = next(v for v in body["verdicts"] if v["persona"] == "Brené Brown")
        assert "plat" in brene["flagged_ids"]
        assert any(f["severity"] == "warning" for f in brene["findings"])

    @pytest.mark.asyncio
    async def test_audit_banned_phrase_fails_voice_fidelity(self, client: AsyncClient) -> None:
        body_json = {
            "items": [_item_payload("corp", "Great point, let's circle back on that.")],
            "mode": "deterministic",
        }
        response = await client.post("/api/v1/audits", json=body_json, headers=_auth_headers())
        assert response.status_code == 200
        body = response.json()
        assert body["passed"] is False

    @pytest.mark.asyncio
    async def test_audit_empty_items_rejected(self, client: AsyncClient) -> None:
        response = await client.post("/api/v1/audits", json={"items": []}, headers=_auth_headers())
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_audit_invalid_mode_rejected(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/audits",
            json={"items": [_item_payload()], "mode": "vibes"},
            headers=_auth_headers(),
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_audit_oversize_item_rejected(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/audits",
            json={"items": [_item_payload("big", "x" * 8_001)], "mode": "deterministic"},
            headers=_auth_headers(),
        )
        assert response.status_code == 422


class TestQuaditServiceAdapter:
    """Unit tests for the pe-side quadit service."""

    def test_audit_content_deterministic_passes_clean(self) -> None:
        items = [AuditItem(id="r1", kind="ai_response", author_role="pe-service", content="ok text")]
        report = audit_content(items)
        assert report.passed
        assert report.mode == "deterministic"

    def test_audit_content_rejects_unknown_mode(self) -> None:
        items = [AuditItem(id="r1", kind="ai_response", author_role="pe-service", content="ok")]
        with pytest.raises(ValueError, match="Unknown audit mode"):
            audit_content(items, mode="vibes")

    def test_audit_content_unknown_auditor_raises(self) -> None:
        items = [AuditItem(id="r1", kind="ai_response", author_role="pe-service", content="ok")]
        with pytest.raises(FileNotFoundError):
            audit_content(items, auditors=("nonexistent_auditor",))

    def test_provider_bridge_sends_prompt_as_user_message(self) -> None:
        class RecordingProvider:
            """Structural LLM provider — the ai nominal base resolves as Any
            in CI (no submodule checkout), so subclassing it is not
            type-safe there."""

            def __init__(self) -> None:
                self.calls: list[list[dict[str, str]]] = []

            def generate(self, messages: list[dict[str, str]]) -> str:
                self.calls.append(messages)
                return '{"score": 1.0, "passed": true, "notes": "ok", "flagged_ids": []}'

        provider = RecordingProvider()
        bridge: ProviderQuaditClient = ProviderQuaditClient(provider)
        reply = bridge.chat("audit prompt here")
        assert reply.startswith('{"score"')
        assert provider.calls == [[{"role": "user", "content": "audit prompt here"}]]
