"""Quadit audit service — runs the ai quad-audit core over pe content.

Adapts the shared quadit core (``ai.research.quadit``) to the pe backend:

- ``ProviderQuaditClient`` bridges the pe LLM provider factory to the
  quadit ``QuaditLLMClient`` protocol.
- ``audit_content`` runs the quad audit over submitted items, in
  deterministic (pattern-scan) or LLM mode, with the adversarial
  auditor personas loaded from the shipped TOML descriptors.
"""

from __future__ import annotations

from typing import Protocol

from ai.research.quadit import AuditItem, QuadAuditReport, load_auditor_descriptor
from ai.research.quadit.personas import AuditorDescriptor
from ai.research.quadit.review import QuaditLLMClient, run_quadit_audit
from src.pe.core.llm_factory import LLMProviderFactory

DEFAULT_AUDITORS = ("brene_brown",)


class LLMProviderProtocol(Protocol):
    """Structural stand-in for ``ai.pipelines...LLMProvider``.

    The ai submodule is not checked out in CI, where the nominal import
    resolves as Any — so the bridge depends only on the shape it uses.
    """

    def generate(self, messages: list[dict[str, str]]) -> str: ...


class ProviderQuaditClient:
    """Bridge a pe ``LLMProvider`` to the quadit ``QuaditLLMClient`` protocol."""

    def __init__(self, provider: LLMProviderProtocol) -> None:
        self._provider = provider
        # The provider's ``generate`` interface exposes no temperature knob,
        # so the requested temperature is recorded here for diagnostics.
        self.last_temperature: float | None = None

    def chat(self, prompt: str, *, temperature: float = 0.3) -> str:
        """Send the quadit prompt as a single-user-message chat turn."""
        self.last_temperature = temperature
        reply: str = self._provider.generate([{"role": "user", "content": prompt}])
        return reply


def _load_auditors(names: tuple[str, ...]) -> tuple[AuditorDescriptor, ...]:
    return tuple(load_auditor_descriptor(name) for name in names)


def audit_content(
    items: list[AuditItem],
    *,
    mode: str = "deterministic",
    auditors: tuple[str, ...] = DEFAULT_AUDITORS,
) -> QuadAuditReport:
    """Run the quadit audit over pe content.

    ``mode="deterministic"`` uses the pattern-based scorers (no LLM call).
    ``mode="llm"`` builds a provider from the runtime LLM configuration and
    gives the judges and auditors their full prompts.
    """
    if mode == "deterministic":
        return run_quadit_audit(items, auditors=_load_auditors(auditors))

    if mode != "llm":
        raise ValueError(f"Unknown audit mode: {mode!r}. Expected 'deterministic' or 'llm'.")

    provider = LLMProviderFactory.create()
    client: QuaditLLMClient = ProviderQuaditClient(provider)
    return run_quadit_audit(
        items,
        client=client,
        model=getattr(provider, "model", mode),
        auditors=_load_auditors(auditors),
    )
