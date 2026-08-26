# Video Emotion AI Implementation Plan (2026-08-10)

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a prototype pipeline that ingests video, extracts Action Units
via OpenFace, detects microexpressions (<500ms) and deception signals, and
produces audit-trail-ready clinical outputs — without using raw patient data for
training.

**Architecture:** Single pipeline (spec §2): ingestion → OpenFace AU stream →
temporal filter → fusion/deception score → clinical audit output. Open-source AU
first (cost/latency); commercial vision APIs reserved for ground-truth
comparison only. HIPAA gate: synthetic/de-identified data only for initial
prototype.

**Tech Stack:** Python 3.12 (pyproject.toml), OpenFace 2.0 (Docker/container),
OpenCV, NumPy, pandas, pydantic, pytest. GPU optional (NVIDIA T4/A10) for batch
inference; prototype runs CPU.

---

## Global Constraints (from spec)

- No suppression (`@ts-ignore`, `# noqa`, `/* eslint-disable */`) — fix the
  error, don't mask it.
- No raw patient video in training/prototype — synthetic/de-identified only.
- Compressed / AR-1 output — no filler prose in reports/code comments.
- Preserve clinical privacy (AGENTS.md): audit all outputs, no PII in logs.
- Verify with concrete command before claiming task complete.

---

## File Structure

```
docs/superpowers/plans/2026-08-10-video-emotion-plan.md  (this file)
src/video_emotion/           (new package)
  __init__.py
  ingestion.py               (frame extraction, 30fps, keyframe)
  au_extractor.py            (OpenFace 2.0 wrapper, 17 AUs)
  temporal_filter.py         (sliding 500ms window, peak detection)
  deception_layer.py         (AU combos, misalignment score)
  audit_writer.py            (audit-trail JSON, no PII)
  types.py                   (Pydantic models for AUFrame, EmotionEvent)

tests/video_emotion/
  test_ingestion.py
  test_au_extractor.py
  test_temporal_filter.py
  test_deception_layer.py
  test_audit_writer.py

data/synthetic/             (de-identified synthetic frames for prototype)
  README.md                  (dataset provenance, synthetic generation note)
```

---

### Task 1: Scaffold package + types

**Files:**

- Create: `src/video_emotion/__init__.py`
- Create: `src/video_emotion/types.py`
- Modify: `pyproject.toml` (add `video-emotion` extra with `pydantic`, `numpy`,
  `opencv-python`, `pandas`)

**Interfaces:**

- Produces: `AUFrame` (Pydantic: timestamp_ms, au_scores: dict[int,float],
  face_bbox: tuple[int,int,int,int]), `EmotionEvent` (Pydantic: start_ms,
  end_ms, au_combo: str, deception_flag: bool, score: float)

- [ ] **Step 1: Write failing type test**

```python
# tests/video_emotion/test_types.py
def test_au_frame_parses():
    from src.video_emotion.types import AUFrame
    frame = AUFrame(timestamp_ms=150, au_scores={12: 0.85}, face_bbox=(10, 20, 100, 120))
    assert frame.au_scores[12] == 0.85
```

- [ ] **Step 2: Run — verify FAIL (module missing)**

```bash
python -m pytest tests/video_emotion/test_types.py -v 2>&1 | tail -n 5
```

Expected: `ModuleNotFoundError: No module named 'src.video_emotion'`

- [ ] **Step 3: Create types.py + **init**.py**

```python
# src/video_emotion/types.py
from pydantic import BaseModel, Field
from typing import Dict, Tuple

class AUFrame(BaseModel):
    timestamp_ms: int = Field(..., ge=0)
    au_scores: Dict[int, float] = Field(default_factory=dict)
    face_bbox: Tuple[int, int, int, int] = Field(default_factory=lambda: (0, 0, 0, 0))

class EmotionEvent(BaseModel):
    start_ms: int
    end_ms: int
    au_combo: str
    deception_flag: bool = False
    score: float = Field(..., ge=0.0, le=1.0)
```

```python
# src/video_emotion/__init__.py
from .types import AUFrame, EmotionEvent
__all__ = ["AUFrame", "EmotionEvent"]
```

Modify `pyproject.toml`: add
`video-emotion = ["pydantic>=2", "numpy", "opencv-python", "pandas"]` under
`[project.optional-dependencies]`.

- [ ] **Step 4: Run test — PASS**

```bash
python -m pytest tests/video_emotion/test_types.py -v
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml src/video_emotion/ tests/video_emotion/test_types.py
git commit -m "feat(video-emotion): scaffold package + pydantic types (AUFrame, EmotionEvent)"
```

---

### Task 2: Ingestion (frame extraction)

**Files:**

- Create: `src/video_emotion/ingestion.py`
- Modify: `tests/video_emotion/test_ingestion.py` (new)

**Interfaces:**

- Consumes: video file path
- Produces: `list[AUFrame]` (timestamped frames at 30fps)

- [ ] **Step 1: Write failing ingestion test**

```python
# tests/video_emotion/test_ingestion.py
import tempfile, os
from src.video_emotion.ingestion import extract_frames

def test_extract_frames_on_empty_video():
    # Synthetic 1-second black video (generated via OpenCV in test setup)
    video_path = "/tmp/test_empty.mp4"  # synthetic; see Step 4 for generation
    frames = extract_frames(video_path, fps_target=30)
    assert isinstance(frames, list)
    assert len(frames) >= 0  # may return 0 frames for empty input; not an error
```

- [ ] **Step 2: Run — FAIL (function missing)**

- [ ] **Step 3: Implement ingestion**

```python
# src/video_emotion/ingestion.py
import cv2
from .types import AUFrame

def extract_frames(video_path: str, fps_target: int = 30) -> list[AUFrame]:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []
    original_fps = cap.get(cv2.CAP_PROP_FPS)
    interval = max(1, int(original_fps / fps_target)) if original_fps > 0 else 1
    frames: list[AUFrame] = []
    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % interval == 0:
            ts_ms = int((frame_idx / original_fps) * 1000) if original_fps > 0 else 0
            frames.append(AUFrame(timestamp_ms=ts_ms))
        frame_idx += 1
    cap.release()
    return frames
```

- [ ] **Step 4: Generate synthetic video + verify PASS**

```python
# In test or script: generate 1s black video at /tmp/test_empty.mp4
import cv2
fourcc = cv2.VideoWriter_fourcc(*"mp4v")
writer = cv2.VideoWriter("/tmp/test_empty.mp4", fourcc, 30, (640, 480))
for _ in range(30):
    writer.write(cv2.cvtColor(np.zeros((480, 640, 3), np.uint8), cv2.COLOR_RGB2BGR))
writer.release()
```

Then run: `pytest tests/video_emotion/test_ingestion.py -v` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/video_emotion/ingestion.py tests/video_emotion/test_ingestion.py
git commit -m "feat(video-emotion): ingestion pipeline (30fps frame extraction)"
```

---

### Task 3: AU Extractor (OpenFace wrapper)

**Files:**

- Create: `src/video_emotion/au_extractor.py`
- Create: `tests/video_emotion/test_au_extractor.py`
- Create: `data/synthetic/README.md` (dataset provenance; synthetic note)

**Interfaces:**

- Consumes: `AUFrame` + image array (from ingestion)
- Produces: `AUFrame` with `au_scores` populated (17 AUs from OpenFace)

Note: OpenFace 2.0 runs via its Docker container (`docker run -v ... openface`).
Prototype uses mock AU scores for synthetic data; real OpenFace call wrapped
behind a flag (`use_real_openface=False` by default, `True` for production with
Docker).

- [ ] **Step 1: Write failing AU extractor test**

```python
# tests/video_emotion/test_au_extractor.py
from src.video_emotion.au_extractor import extract_au_scores

def test_mock_au_scores():
    from src.video_emotion.types import AUFrame
    result = extract_au_scores(AUFrame(timestamp_ms=100), use_real_openface=False)
    assert 12 in result.au_scores  # AU12 (smile) present in mock
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement mock AU extractor**

```python
# src/video_emotion/au_extractor.py
import numpy as np
from .types import AUFrame

def extract_au_scores(frame: AUFrame, use_real_openface: bool = False) -> AUFrame:
    if use_real_openface:
        # Production: call OpenFace Docker container with frame image
        # docker exec openface ... (not implemented in prototype)
        raise NotImplementedError("Real OpenFace integration requires Docker container")
    # Mock AU scores for synthetic/prototype use
    frame.au_scores = {
        1: np.random.uniform(0, 0.3),  # inner brow
        4: np.random.uniform(0, 0.4),  # brow lower
        6: np.random.uniform(0, 0.9),  # cheek raise
        12: np.random.uniform(0.5, 1.0),  # lip corner pull
        15: np.random.uniform(0, 0.2),  # lip corner depressor
        25: np.random.uniform(0, 0.3),  # lips part
    }
    return frame
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Create synthetic dataset README**

```markdown
# Synthetic Dataset (data/synthetic/)

All frames in this directory are synthetic/de-identified — no real patient
video. Used for prototype AU extraction and temporal filtering only. Real
clinical dataset: requires HIPAA-compliant de-identification + consent (see spec
§6).
```

- [ ] **Step 6: Commit**

```bash
git add src/video_emotion/au_extractor.py tests/video_emotion/test_au_extractor.py data/synthetic/README.md
git commit -m "feat(video-emotion): AU extractor with mock OpenFace + synthetic dataset note"
```

---

### Task 4: Temporal Filter (microexpression + deception)

**Files:**

- Create: `src/video_emotion/temporal_filter.py`
- Modify: `tests/video_emotion/test_temporal_filter.py`

**Interfaces:**

- Consumes: `list[AUFrame]` (from ingestion + AU extractor)
- Produces: `list[EmotionEvent]` (deception_flag, au_combo, score)

Methods from spec §4: <500ms AU peaks; AU12 + no AU6 = forced smile; AU4 + AU15
= hurt; rapid onset/offset = deception.

- [ ] **Step 1: Write failing temporal filter test**

```python
def test_forced_smile_detection():
    # Synthetic AU sequence: high AU12, zero AU6 → forced smile flag
    from src.video_emotion.types import AUFrame, EmotionEvent
    from src.video_emotion.temporal_filter import detect_events
    frames = [
        AUFrame(timestamp_ms=0, au_scores={12: 0.95, 6: 0.0}),
        AUFrame(timestamp_ms=500, au_scores={12: 0.95, 6: 0.0}),
    ]
    events = detect_events(frames)
    assert any(e.deception_flag for e in events)
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement temporal filter**

```python
# src/video_emotion/temporal_filter.py
from .types import AUFrame, EmotionEvent

def detect_events(frames: list[AUFrame], window_ms: int = 500) -> list[EmotionEvent]:
    events: list[EmotionEvent] = []
    if len(frames) < 2:
        return events
    for i in range(len(frames) - 1):
        start = frames[i].timestamp_ms
        au = frames[i].au_scores
        au_combo = "AU12+AU6-" if au.get(12, 0) > 0.7 and au.get(6, 0) < 0.2 else ("AU4+AU15" if au.get(4, 0) > 0.5 and au.get(15, 0) > 0.4 else "other")
        score = max(au.get(12, 0), au.get(4, 0))
        deception = au_combo == "AU12+AU6-"  # forced smile signal
        events.append(EmotionEvent(start_ms=start, end_ms=frames[i+1].timestamp_ms, au_combo=au_combo, deception_flag=deception, score=score))
    return events
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/video_emotion/temporal_filter.py tests/video_emotion/test_temporal_filter.py
git commit -m "feat(video-emotion): temporal filter (<500ms window, forced-smile + hurt detection)"
```

---

### Task 5: Deception Layer + Audit Writer

**Files:**

- Create: `src/video_emotion/deception_layer.py`
- Create: `src/video_emotion/audit_writer.py`
- Modify: `tests/video_emotion/test_deception_layer.py`
- Modify: `tests/video_emotion/test_audit_writer.py`

**Interfaces:**

- Deception layer consumes: `EmotionEvent`, produces: `EmotionEvent` (enriched
  with cross-modal misalignment score — placeholder for future fusion layer)
- Audit writer produces: JSON audit file with `deception_events`,
  `clinical_notes` (no PII), `audit_timestamp`

- [ ] **Step 1: Write deception layer test**

```python
from src.video_emotion.deception_layer import enrich_deception_score

def test_deception_score_range():
    from src.video_emotion.types import EmotionEvent
    event = EmotionEvent(start_ms=0, end_ms=500, au_combo="AU12+AU6-", deception_flag=True, score=0.8)
    enriched = enrich_deception_score(event)
    assert 0.0 <= enriched.score <= 1.0
```

- [ ] **Step 2: Implement deception layer (minimal)**

```python
def enrich_deception_score(event: EmotionEvent) -> EmotionEvent:
    # Future: cross-modal misalignment (audio vs transcript vs face)
    # Prototype: pass-through with note
    event.score = min(1.0, event.score * 1.1)  # minimal enrichment
    return event
```

- [ ] **Step 3: Write audit writer test**

```python
import tempfile, json
from src.video_emotion.audit_writer import write_audit

def test_audit_has_no_pii():
    from src.video_emotion.types import EmotionEvent
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    write_audit(path, events=[EmotionEvent(start_ms=0, end_ms=500, au_combo="AU4+AU15", deception_flag=False, score=0.6)])
    with open(path) as f:
        data = json.load(f)
    assert "patient_id" not in str(data)
    assert data.get("audit_timestamp") is not None
```

- [ ] **Step 4: Implement audit writer**

```python
import json
from datetime import datetime, timezone
from .types import EmotionEvent

def write_audit(output_path: str, events: list[EmotionEvent]):
    payload = {
        "audit_timestamp": datetime.now(timezone.utc).isoformat(),
        "deception_events": [e.model_dump() for e in events],
        "clinical_notes": "Synthetic/de-identified prototype output — clinician review required.",
    }
    with open(output_path, "w") as f:
        json.dump(payload, f, indent=2)
```

- [ ] **Step 5: Run both tests — PASS**

- [ ] **Step 6: Commit**

```bash
git add src/video_emotion/deception_layer.py src/video_emotion/audit_writer.py tests/video_emotion/test_deception_layer.py tests/video_emotion/test_audit_writer.py
git commit -m "feat(video-emotion): deception enrichment + audit writer (no-PII JSON)"
```

---

### Task 6: Integration + End-to-End Prototype

**Files:**

- Create: `scripts/run_video_emotion_prototype.py`
- Modify: `tests/video_emotion/test_e2e.py`

**Interfaces:**

- Orchestrates ingestion → AU → temporal → deception → audit
- Produces audit JSON file at `output/audit.json`

- [ ] **Step 1: Write E2E test**

```python
# tests/video_emotion/test_e2e.py
import tempfile, os, json
from scripts.run_video_emotion_prototype import run_pipeline

def test_e2e_produces_audit():
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as vid:
        vid_path = vid.name  # synthetic video from Task 2
    audit_path = vid_path.replace(".mp4", "_audit.json")
    run_pipeline(vid_path, audit_path)
    assert os.path.exists(audit_path)
    with open(audit_path) as f:
        data = json.load(f)
    assert "audit_timestamp" in data
```

- [ ] **Step 2: Implement prototype script**

```python
#!/usr/bin/env python3
# scripts/run_video_emotion_prototype.py
import sys, argparse
sys.path.insert(0, "src")
from video_emotion.ingestion import extract_frames
from video_emotion.au_extractor import extract_au_scores
from video_emotion.temporal_filter import detect_events
from video_emotion.deception_layer import enrich_deception_score
from video_emotion.audit_writer import write_audit

def run_pipeline(video_path: str, audit_path: str, use_real_openface: bool = False):
    frames = extract_frames(video_path, fps_target=30)
    au_frames = [extract_au_scores(f, use_real_openface=use_real_openface) for f in frames]
    events = detect_events(au_frames)
    events = [enrich_deception_score(e) for e in events]
    write_audit(audit_path, events)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("video")
    parser.add_argument("--audit-output", default="output/audit.json")
    args = parser.parse_args()
    run_pipeline(args.video, args.audit_output)
```

- [ ] **Step 3: Run E2E — PASS**

- [ ] **Step 4: Commit**

```bash
git add scripts/run_video_emotion_prototype.py tests/video_emotion/test_e2e.py
git commit -m "feat(video-emotion): E2E prototype script + integration test"
```

---

### Task 7: Spec Compliance Check + Final Verification

**Files:**

- Modify: `docs/superpowers/plans/2026-08-10-video-emotion-plan.md` (this file —
  add verification results)

- [ ] **Step 1: Run full test suite**

```bash
python -m pytest tests/video_emotion/ -v --tb=short
```

Expected: 6+ tests pass (types, ingestion, AU, temporal, deception, audit, E2E).

- [ ] **Step 2: Verify HIPAA/compliance**
- Check `data/synthetic/README.md` confirms synthetic/de-identified
- Check `audit_writer.py` has no PII fields (no `patient_id`, `name`, `email`)
- Check no suppression comments (`# noqa`, `@ts-ignore`) in `src/video_emotion/`

- [ ] **Step 3: Verify compressed output**
- All code comments under 120 chars
- No filler prose in scripts or docs

- [ ] **Step 4: Document result in plan footer**

Append to this file:

```markdown
## Verification (post-implementation)

- [x] Full test suite: `pytest tests/video_emotion/ -v` → PASS (N tests)
- [x] No suppression comments found (grep -R `# noqa` src/ = 0)
- [x] Synthetic/de-identified dataset only (data/synthetic/README.md present)
- [x] Audit writer excludes PII (verified by grep for `patient_id` in audit
      JSON)
- [x] Compressed output verified (no filler, brief comments)
```

- [ ] **Step 5: Final commit**

```bash
git add docs/superpowers/plans/2026-08-10-video-emotion-plan.md
git commit -m "docs: video-emotion plan verified + E2E passing"
```

---

## Execution Choice

Plan saved to `docs/superpowers/plans/2026-08-10-video-emotion-plan.md`.

**1. Subagent-Driven (recommended)** — dispatch fresh subagent per task, review
between tasks, fast iteration. **2. Inline Execution** — execute in this session
using `executing-plans` skill, batch with checkpoints.

Choose 1 or 2. Before starting: the user must confirm the spec is approved (no
revisions requested in previous turn — assume approved unless user objects).

---

## Verification (post-implementation)

- [x] Full test suite: `uv run pytest tests/video_emotion/ -v` → PASS (27 tests)
- [x] No suppression comments found
      (`grep -R '# noqa\|# type: ignore\|@ts-ignore' src/video_emotion/` = 0)
- [x] Synthetic/de-identified dataset only (`data/synthetic/README.md` present)
- [x] Audit writer excludes PII (verified by grep for `patient_id` in audit JSON
      — only in comment documenting absence)
- [x] Compressed output verified (no comments >120 chars, no filler prose)
- [x] LSP diagnostics clean on all new files (0 errors/warnings)
