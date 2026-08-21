"""Load shared builder code in package and standalone Data Designer execution."""

from __future__ import annotations

import sys
from importlib import import_module
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[4]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

_common = import_module("scripts.data.designer.common")
_schemas = import_module("scripts.data.designer.product_schemas")

build_product_config: Any = _common.build_product_config
TherapeuticSFTDraft: Any = _schemas.TherapeuticSFTDraft
LongRunningTherapyDraft: Any = _schemas.LongRunningTherapyDraft
CPTSDDialogueDraft: Any = _schemas.CPTSDDialogueDraft
EdgeCaseDraft: Any = _schemas.EdgeCaseDraft
CrisisSafetyDraft: Any = _schemas.CrisisSafetyDraft
DPOPreferenceDraft: Any = _schemas.DPOPreferenceDraft
KnowledgeTaskDraft: Any = _schemas.KnowledgeTaskDraft
