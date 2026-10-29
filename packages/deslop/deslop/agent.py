"""AgentGuard — Portable LLM agent interceptor and retry loop coordinator.

Wraps any LLM call (OpenAI, Anthropic, Ollama, LangChain, LiteLLM, or custom)
with automatic sycophancy checking, retry prompting, and optional slop removal.
"""

from __future__ import annotations

import inspect
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from deslop.engine import clean_text
from deslop.gate import AntiSycophancyGate, GateResult
from deslop.rules.core import RuleSet


@dataclass(slots=True)
class GuardedExecution:
    """Detailed audit trace for a guarded generation sequence."""

    final_text: str
    passed: bool
    attempts: int
    rejections: list[str]
    cleaned_residual_slop: bool = False


class AgentGuard:
    """Wraps agent turns and LLM calls with anti-sycophancy gating and deslopping."""

    def __init__(
        self,
        gate: AntiSycophancyGate | None = None,
        *,
        auto_clean_residual: bool = False,
        clean_rules: RuleSet | None = None,
        clean_packs: tuple[str, ...] | list[str] = ("generic-ai", "sycophancy"),
    ) -> None:
        self.gate = gate or AntiSycophancyGate.default()
        self.auto_clean_residual = auto_clean_residual
        self.clean_rules = clean_rules
        self.clean_packs = tuple(clean_packs)

    def check(self, text: str) -> GateResult:
        """Validate text against the anti-sycophancy gate."""
        return self.gate.check(text)

    def clean(self, text: str) -> str:
        """Deterministically remove filler phrases and slop."""
        return clean_text(text, rules=self.clean_rules, packs=self.clean_packs)

    def run(
        self,
        call_fn: Callable[[Any], str],
        prompt_or_messages: Any,
        *,
        max_retries: int = 3,
    ) -> str:
        """Execute a sync LLM generation call with bounded retry on gate failure."""
        execution = self.run_detailed(call_fn, prompt_or_messages, max_retries=max_retries)
        return execution.final_text

    async def arun(
        self,
        call_fn: Callable[[Any], Awaitable[str]],
        prompt_or_messages: Any,
        *,
        max_retries: int = 3,
    ) -> str:
        """Execute an async LLM generation call with bounded retry on gate failure."""
        execution = await self.arun_detailed(call_fn, prompt_or_messages, max_retries=max_retries)
        return execution.final_text

    def run_detailed(
        self,
        call_fn: Callable[[Any], str],
        prompt_or_messages: Any,
        *,
        max_retries: int = 3,
    ) -> GuardedExecution:
        """Execute sync generation with full audit trace."""
        current_input = prompt_or_messages
        rejections: list[str] = []

        for attempt in range(1, max_retries + 1):
            response = call_fn(current_input)
            result = self.gate.check(response)

            if result.passed:
                final = self.clean(response) if self.auto_clean_residual else response
                return GuardedExecution(
                    final_text=final,
                    passed=True,
                    attempts=attempt,
                    rejections=rejections,
                    cleaned_residual_slop=self.auto_clean_residual,
                )

            rejections.append(result.reason)
            current_input = self._build_retry_input(current_input, response, result.correction)

        # Retries exhausted; optionally clean or return the last draft
        final = self.clean(response) if self.auto_clean_residual else response
        return GuardedExecution(
            final_text=final,
            passed=False,
            attempts=max_retries,
            rejections=rejections,
            cleaned_residual_slop=self.auto_clean_residual,
        )

    async def arun_detailed(
        self,
        call_fn: Callable[[Any], Awaitable[str]],
        prompt_or_messages: Any,
        *,
        max_retries: int = 3,
    ) -> GuardedExecution:
        """Execute async generation with full audit trace."""
        current_input = prompt_or_messages
        rejections: list[str] = []

        for attempt in range(1, max_retries + 1):
            res = call_fn(current_input)
            if inspect.isawaitable(res):
                response = await res
            else:
                response = res

            result = self.gate.check(response)

            if result.passed:
                final = self.clean(response) if self.auto_clean_residual else response
                return GuardedExecution(
                    final_text=final,
                    passed=True,
                    attempts=attempt,
                    rejections=rejections,
                    cleaned_residual_slop=self.auto_clean_residual,
                )

            rejections.append(result.reason)
            current_input = self._build_retry_input(current_input, response, result.correction)

        final = self.clean(response) if self.auto_clean_residual else response
        return GuardedExecution(
            final_text=final,
            passed=False,
            attempts=max_retries,
            rejections=rejections,
            cleaned_residual_slop=self.auto_clean_residual,
        )

    def _build_retry_input(self, original_input: Any, previous_draft: str, correction: str) -> Any:
        """Inject correction into prompt string or chat messages list."""
        if isinstance(original_input, str):
            return f"{original_input}\n\n[System Note: {correction}]"

        if isinstance(original_input, list):
            # Preserves ChatML / OpenAI-style messages list
            new_messages = list(original_input)
            new_messages.append({"role": "assistant", "content": previous_draft})
            new_messages.append({"role": "user", "content": f"[System Guidance]: {correction}"})
            return new_messages

        return original_input
