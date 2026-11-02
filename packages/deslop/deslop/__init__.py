"""Deslop: Dataset Hygiene & Agent Anti-Sycophancy Engine.

Cleans AI slop from datasets and intercepts sycophancy, caving phrases, and canned
clichés in real-time agent generation loops.
"""

from __future__ import annotations

from deslop.agent import AgentGuard, GuardedExecution
from deslop.engine import (
    CleanOptions,
    apply_deslop_to_file,
    clean_record,
    clean_text,
    normalize_spacing,
    preview_file,
    remove_slop,
    scan_text,
)
from deslop.gate import (
    ASSISTANT_ROLES,
    BANNED_OPENERS,
    CANNED_REFLECTIONS,
    CAVING_PHRASES,
    PARROTING_OPENERS,
    ROBOTIC_CRISIS_QUESTIONS,
    ROBOTIC_SOMATIC_PHRASES,
    AntiSycophancyGate,
    GateResult,
    correction_for_reason,
    is_sycophantic,
    reject_reason_for_record,
)
from deslop.models import (
    CleanReport,
    Finding,
    JsonObject,
    JsonValue,
    PreviewItem,
    PreviewReport,
    RegenReport,
    ScanReport,
)
from deslop.rules.core import (
    DEFAULT_MARKERS,
    DEFAULT_REPLACEMENTS,
    DEFAULT_RULE_PACKS,
    RuleSet,
    load_rule_set,
)
from deslop.scanner import ScanOptions, scan_file

__version__ = "0.3.0"

__all__ = [
    "ASSISTANT_ROLES",
    "BANNED_OPENERS",
    "CANNED_REFLECTIONS",
    "CAVING_PHRASES",
    "DEFAULT_MARKERS",
    "DEFAULT_REPLACEMENTS",
    "DEFAULT_RULE_PACKS",
    "PARROTING_OPENERS",
    "ROBOTIC_CRISIS_QUESTIONS",
    "ROBOTIC_SOMATIC_PHRASES",
    "AgentGuard",
    "AntiSycophancyGate",
    "CleanOptions",
    "CleanReport",
    "Finding",
    "GateResult",
    "GuardedExecution",
    "JsonObject",
    "JsonValue",
    "PreviewItem",
    "PreviewReport",
    "RegenReport",
    "RuleSet",
    "ScanOptions",
    "ScanReport",
    "__version__",
    "apply_deslop_to_file",
    "clean_record",
    "clean_text",
    "correction_for_reason",
    "is_sycophantic",
    "load_rule_set",
    "normalize_spacing",
    "preview_file",
    "reject_reason_for_record",
    "remove_slop",
    "scan_file",
    "scan_text",
]
