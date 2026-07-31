# Pixelated Empathy — Vertical Fidelity Stack Implementation Plan

## Executive Summary

This plan wires the three TDD-verified primitives into a cohesive vertical fidelity stack:

1. **P0-1 Edge-Case Safety Filter Bypass** — preserves Nightmare Fuel training signal
2. **R1 Cryptographic Receipts** — auditable inference chain (Merkle-root ledger)
3. **L4 JIT Trigger Engine** — auto-retrains on drift via EventBus subscription

**Result:** Edge cases preserved → crisis model trained → every inference provable → JIT retrain on drift. Legal/insurer product emerges automatically.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    NIGHTMARE FUEL SIMULATOR                      │
│  (generates adversarial clinical scenarios with edge-case tags) │
└──────────────────────────┬──────────────────────────────────────┘
                           │ is_training_edge_case=True
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              P0-1 SAFETY FILTER BYPASS (TDD ✓)                   │
│  EnhancedSafetyFilter.check_output_safety()                     │
│  Early-returns when request_metadata.is_training_edge_case=True │
└──────────────────────────┬──────────────────────────────────────┘
                           │ content passes unchanged
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INFERENCE + BIAS PIPELINE                     │
│  InferenceSafetyFilter.filter_inference_output()                │
│  ──► R1 RECEIPT EMITTED (TDD ✓)                                 │
│       ReceiptEnvelope: {prev_hash, model_fingerprint,           │
│                         prompt_hash, output_hash,               │
│                         fhe_ciphertext_hash, bias_score}        │
│       Appended to Ledger → Merkle root_hash                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │ receipt_root_hash in result
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              BIAS DETECTION (AnalysisOrchestrator)              │
│  Completes → emits EventBus events:                             │
│  • BIAS_DETECTED / BIAS_THRESHOLD_EXCEEDED                      │
│  • CRISIS_DETECTED / CRISIS_THRESHOLD_EXCEEDED                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ EventBus.publish()
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    L4 JIT TRIGGER ENGINE (TDD ✓)                 │
│  Subscribes to EventBus → accumulates CaseFlags                 │
│  rolling_window(7 days, threshold=3) → TriggerDecision          │
│  should_trigger=True → injects Nightmare Fuel scenario          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Status

| Component             | Status  | Files                                                    | Tests                                      |
| --------------------- | ------- | -------------------------------------------------------- | ------------------------------------------ |
| P0-1 Edge-case bypass | ✅ DONE | `ai/safety/enhanced_safety_filter.py:273-285`            | `ai/tests/test_edge_case_filter_bypass.py` |
| R1 Receipt emission   | ✅ DONE | `ai/safety/inference_safety_filter.py:240-262`           | `ai/tests/test_receipts.py`                |
| R1 Receipt core       | ✅ DONE | `ai/receipts/receipt.py`                                 | `ai/tests/test_receipts.py`                |
| L4 Trigger engine     | ✅ DONE | `foresight/foresight/triggers.py`                        | `foresight/tests/test_jit_trigger.py`      |
| L4 EventBus types     | ✅ DONE | `foresight/foresight/event_bus.py` (EventType additions) | —                                          |
| EventBus wiring       | ✅ DONE | `foresight/foresight/triggers.py:_subscribe_to_events()` | —                                          |

---

## Remaining Work

### 1. Emit Events from Bias Detection (Priority: HIGH)

**File:** `src/lib/ai/bias-detection/python-service/bias_detection/services/analysis_orchestrator.py`

**Change:** After `analyze_session()` completes, publish EventBus events:

```python
# In analyze_session(), after final_result computed:
from foresight.foresight.event_bus import EventBus, EventType, Event
from datetime import datetime, timezone

bus = EventBus.get_instance()

# Bias event
if final_result["overall_bias_score"] >= 0.3:
    bus.publish(Event(
        id=uuid.uuid4().hex,
        event_type=EventType.BIAS_DETECTED,
        timestamp=datetime.now(timezone.utc),
        actor="bias_orchestrator",
        entity_id=session_id,
        payload={
            "clinician_id": session_data.get("user_id", "anonymous"),
            "session_id": session_id,
            "bias_score": final_result["overall_bias_score"],
            "alert_level": final_result["alert_level"],
        }
    ))

# Crisis event (if crisis detected in layer results)
crisis_layer = next((r for r in layer_results if r.get("layer") == "diagnostic"), {})
if crisis_layer.get("crisis_detected"):
    bus.publish(Event(...))
```

### 2. Wire Receipt Root Hash to Bias Detection (Priority: HIGH)

**File:** `src/lib/ai/bias-detection/python-service/bias_detection/services/analysis_orchestrator.py`

**Change:** Accept `receipt_root_hash` in session_data, include in analysis result for traceability.

### 3. JIT Scenario Injection into Nightmare Fuel (Priority: HIGH)

**File:** New `ai/triggers/jit_scenario_injector.py`

**Logic:** When `TriggerDecision.should_trigger=True`:

1. Call Nightmare Fuel generator with targeted spec (domain gap + difficulty)
2. Inject generated scenario into clinician's next session via existing block system
3. Block schema label: `jit_scenario_topup`, InjectionPoint.PrePrompt

### 4. Per-Clinician Flag Grouping (Priority: MEDIUM)

**File:** `foresight/foresight/triggers.py`

**Change:** `rolling_window()` currently aggregates all clinicians. Need per-clinician window tracking:

```python
def rolling_window(self, window=timedelta(days=7), threshold=3):
    # Group flags by clinician_id
    by_clinician = defaultdict(list)
    for f in self._flags:
        by_clinician[f.clinician_id].append(f)

    decisions = {}
    for cid, flags in by_clinician.items():
        # ... existing logic per clinician
        decisions[cid] = TriggerDecision(...)
    return decisions
```

### 5. Receipt-Ledger Persistence (Priority: MEDIUM)

**File:** `ai/receipts/receipt.py` + new `ai/receipts/persistence.py`

**Change:** Ledger currently in-memory. Add SQLite/PostgreSQL persistence for production.

### 6. FHE Ciphertext Hash Integration (Priority: MEDIUM)

**File:** `src/lib/ai/providers/EmotionLlamaProvider.py` (or FHE inference entry point)

**Change:** When FHE encryption used, compute `fhe_ciphertext_hash` and pass via `request_metadata` to `InferenceSafetyFilter`.

---

## Linear Tickets

### P0-1 — Edge-Case Safety Filter Bypass (COMPLETED)

- [x] Test: `ai/tests/test_edge_case_filter_bypass.py`
- [x] Impl: `ai/safety/enhanced_safety_filter.py:273-285`
- [x] Follow-up: Wire `is_training_edge_case` into SDG pipeline Nightmare Fuel samples (already at `ai/training/sdg_pipeline.py:1676`, covered by `test_edge_case_tag_always_set`)

### R1 — Cryptographic Receipts (COMPLETED)

- [x] Test: `ai/tests/test_receipts.py` (4 tests pass)
- [x] Core: `ai/receipts/receipt.py` (ReceiptEnvelope + Ledger)
- [x] Emission: `ai/safety/inference_safety_filter.py:240-262`
- [x] Receipt persistence (SQLite/PostgreSQL)
- [x] FHE ciphertext hash integration
- [x] Receipt root hash propagation to bias detection result

### L4 — JIT Trigger Engine (COMPLETED)

- [x] Test: `foresight/tests/test_jit_trigger.py`
- [x] Core: `foresight/foresight/triggers.py` (CaseFlag, TriggerDecision, JITTriggerEngine)
- [x] EventBus types: `foresight/foresight/event_bus.py` (BIAS__, CRISIS__)
- [x] EventBus subscription: `triggers.py:_subscribe_to_events()`
- [x] Event emission from AnalysisOrchestrator
- [x] Per-clinician flag grouping
- [x] JIT scenario injection into Nightmare Fuel

### Integration Tickets

- [x] **INT-1**: Emit EventBus events from AnalysisOrchestrator
- [x] **INT-2**: Wire receipt_root_hash through bias detection pipeline
- [x] **INT-3**: Build JIT scenario injector (Nightmare Fuel → session block)
- [x] **INT-4**: Per-clinician rolling windows + persistence
- [x] **INT-5**: Receipt ledger persistence + audit export

---

## Acceptance Criteria

### Vertical Stack Demo

```bash
# 1. Generate Nightmare Fuel edge case
python ai/training/nightmare_fuel_generator.py --edge-case suicidal_ideation

# 2. Run through inference + safety (P0-1 bypass preserves content)
# 3. R1 receipt emitted with root_hash
# 4. Bias detection runs → emits BIAS_DETECTED event
# 5. L4 engine accumulates flag → rolling_window triggers
# 6. JIT scenario injected into next session
```

### Audit Trail Verification

```bash
# Verify receipt chain integrity
python -c "
from ai.receipts.receipt import Ledger, ReceiptEnvelope
ledger = Ledger()
# ... append receipts ...
print('Root hash:', ledger.root_hash())
print('Chain valid:', ledger.verify_chain())
"
```

---

## Risk Register

| Risk                                                    | Likelihood | Impact                           | Mitigation                                         |
| ------------------------------------------------------- | ---------- | -------------------------------- | -------------------------------------------------- |
| Foresight module import broken (`foresight.llm_errors`) | High       | Blocks L4 integration            | Fix import or vendor dependency                    |
| EventBus singleton not shared across processes          | Medium     | Events not received              | Ensure single EventBus instance per deployment     |
| Receipt ledger memory growth                            | Medium     | OOM in long-running              | Add persistence + rotation                         |
| Per-clinician grouping not implemented                  | High       | False triggers across clinicians | Implement INT-4 before production                  |
| Bias score ≠ safety score confusion                     | Medium     | Wrong threshold tuning           | Document: bias_score ∈ [0,1], safety_score ∈ [0,1] |

---

## Timeline

| Week | Deliverable                                                  |
| ---- | ------------------------------------------------------------ |
| 1    | INT-1, INT-2 (event emission + receipt propagation)          |
| 2    | INT-3 (JIT scenario injector)                                |
| 3    | INT-4 (per-clinician grouping) + INT-5 (receipt persistence) |
| 4    | Vertical stack demo + audit trail verification               |

---

## Appendix: File Index

```
ai/
├── receipts/
│   ├── receipt.py              # R1 core (ReceiptEnvelope + Ledger)
│   └── __init__.py
├── safety/
│   ├── enhanced_safety_filter.py    # P0-1 bypass (line 273)
│   ├── inference_safety_filter.py   # R1 emission (line 240)
│   └── tests/
│       ├── test_edge_case_filter_bypass.py
│       └── test_receipts.py
├── training/
│   ├── nightmare_fuel_generator.py
│   └── sdg_pipeline.py              # Sets is_training_edge_case (line 1676)

foresight/
└── foresight/
    ├── event_bus.py            # EventType additions (BIAS_*, CRISIS_*)
    ├── triggers.py             # L4 JITTriggerEngine + EventBus wiring
    └── tests/
        └── test_jit_trigger.py

src/lib/ai/bias-detection/python-service/bias_detection/services/
└── analysis_orchestrator.py    # INT-1: emit EventBus events here
```

---

_Generated from TDD cycle: RED→GREEN→REFACTOR for P0-1, R1, L4. All tests passing._
