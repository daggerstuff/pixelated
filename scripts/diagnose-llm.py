#!/usr/bin/env python3
"""Diagnostic CLI for the LLM provider path.

Reads current LLM env vars, constructs a provider via the factory,
makes a trivial completion, and reports model, latency, and response.

Exit 0 on success, non-zero with a clear error message on failure.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

# Ensure the project root is on sys.path so ``src.pe`` is importable.
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from src.pe.config import settings
from src.pe.core.llm_factory import LLMProviderFactory


def main() -> int:
    provider_type = settings.LLM_PROVIDER or "mock"
    model_id = settings.LLM_MODEL_ID or "(not set — provider default)"
    api_key_set = "yes" if settings.LLM_API_KEY else "no"
    base_url = settings.LLM_BASE_URL or "(not set — using provider default)"

    print(f"LLM_PROVIDER      = {provider_type}")
    print(f"LLM_MODEL_ID      = {model_id}")
    print(f"LLM_API_KEY       = {api_key_set}")
    print(f"LLM_BASE_URL      = {base_url}")
    print()

    try:
        provider = LLMProviderFactory.create()
    except ValueError as exc:
        print(f"FAILED to create provider: {exc}", file=sys.stderr)
        return 1

    messages = [{"role": "user", "content": "Respond with the word 'pong'."}]
    start = time.perf_counter()

    try:
        response = provider.generate(messages)
    except Exception as exc:
        elapsed = time.perf_counter() - start
        print(f"FAILED after {elapsed * 1000:.0f} ms", file=sys.stderr)
        print(f"Error: {exc}", file=sys.stderr)
        return 2

    elapsed = time.perf_counter() - start
    model = getattr(provider, "model", "(not exposed)")
    print(f"Model              = {model}")
    print(f"Latency            = {elapsed * 1000:.0f} ms")
    print(f"Response           = {response.strip()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
