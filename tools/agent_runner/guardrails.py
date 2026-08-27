"""Clinical HIPAA, secret leak prevention, and anti-suppression audit engine."""

from __future__ import annotations

import logging
import re

from tools.agent_runner.models import GuardrailsConfig

logger = logging.getLogger("agent_runner.guardrails")


class GuardrailViolationError(Exception):
    """Raised when an unrecoverable guardrail violation occurs."""


class GuardrailsEngine:
    """Audits agent outputs, diffs, and prompts for security, privacy, and quality violations."""

    def __init__(self, config: GuardrailsConfig | None = None):
        self.config = config or GuardrailsConfig()

        # Secret / token patterns
        self.secret_patterns = [
            (
                re.compile(
                    r"(?:api[_-]?key|apikey|secret|password|auth[_-]?token|bearer)\s*[:=]\s*['\"]?([A-Za-z0-9_\-\.]{16,})['\"]?",
                    re.IGNORECASE,
                ),
                "REDACTED_SECRET",
            ),
            (re.compile(r"ghp_[A-Za-z0-9_]{36}"), "REDACTED_GITHUB_TOKEN"),
            (re.compile(r"lin_api_[A-Za-z0-9_]{40,}"), "REDACTED_LINEAR_KEY"),
            (re.compile(r"sk-[A-Za-z0-9_\-]{32,}"), "REDACTED_AI_KEY"),
            (re.compile(r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}"), "REDACTED_JWT"),
        ]

        # Clinical HIPAA / PHI patterns
        self.phi_patterns = [
            (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "REDACTED_SSN"),
            (re.compile(r"\bMRN\s*[:#-]?\s*\d{6,10}\b", re.IGNORECASE), "REDACTED_MRN"),
            (re.compile(r"\bDOB\s*[:#-]?\s*\d{1,2}/\d{1,2}/\d{2,4}\b", re.IGNORECASE), "REDACTED_DOB"),
        ]

        # Anti-suppression patterns
        self.suppression_patterns = [
            (re.compile(r"@ts-ignore\b"), "TypeScript @ts-ignore suppression"),
            (re.compile(r"@ts-nocheck\b"), "TypeScript @ts-nocheck suppression"),
            (re.compile(r"@ts-expect-error\b"), "TypeScript @ts-expect-error suppression"),
            (re.compile(r"#\s*noqa\b"), "Python # noqa lint suppression"),
            (re.compile(r"#\s*type:\s*ignore\b"), "Python # type: ignore type suppression"),
            (re.compile(r"/\*\s*eslint-disable(?:\s+[^*]+)?\*/"), "JavaScript /* eslint-disable */ suppression"),
        ]

    def redact_secrets_and_phi(self, text: str) -> str:
        """Redact tokens, credentials, and clinical PHI identifiers."""
        if not text:
            return text

        redacted = text
        if self.config.secret_leak_prevention:
            for pattern, mask in self.secret_patterns:
                redacted = pattern.sub(f"<{mask}>", redacted)

        if self.config.phi_redaction:
            for pattern, mask in self.phi_patterns:
                redacted = pattern.sub(f"<{mask}>", redacted)

        return redacted

    def audit_code_diff_for_suppressions(self, git_diff: str) -> list[str]:
        """Scan git diff additions (+) for forbidden type/lint suppressions."""
        violations: list[str] = []
        if not self.config.anti_suppression_enforcement or not git_diff:
            return violations

        for line in git_diff.splitlines():
            if line.startswith("+") and not line.startswith("+++"):
                for pattern, desc in self.suppression_patterns:
                    if pattern.search(line):
                        violations.append(
                            f"Anti-Suppression Violation: Found '{desc}' in added diff line: '{line.strip()}'"
                        )

        return violations
