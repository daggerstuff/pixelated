# Nightmare Fuel Protocol: High-Intensity Crisis Simulation

**Created**: 2026-01-25
**Status**: Active / Hydration Phase
**System**: Emotional Intelligence Engine

## Overview
The "Nightmare Fuel" protocol is a specialized adversarial training strategy designed to inoculate the Pixelated Empathy models against **model collapse** during extreme emotional distress. By generating and training on high-intensity crisis scenarios, we ensure the AI remains grounded, professional, and empathetic even when the user is chaotic or non-compliant.

## Methodology

### 1. Generation (`generate_ultra_nightmares.py`)
We inherently generate "seeds" of crisis scenarios that target specific failure modes:
- **Suicidal Ideation**: Passive vs. Active intent.
- **Manic Episodes**: Rapid speech, flight of ideas, grandeur.
- **Psychosis**: Auditory/Visual hallucinations, paranoid delusions.
- **Trauma Dumping**: Overwhelming, disorganized disclosure.

### 2. Hydration (`NightmareHydrator`)
We use a round-robin cycle of high-performance models to flesh out these seeds into realistic 6-turn dialogues:
- **Models Used**:
  - `meta/llama-4-maverick-17b` (High creativity/volatility)
  - `meta/llama-4-scout-17b` await (Adherence to protocol)
  - `nvidia/llama-3.1-nemotron-70b` (Clinical depth)
- **Dialogue Structure**:
  - Client: [EXTREME DISTRESS]
  - Therapist: [Clinical grounding]
  - (Repeated for 3 full cycles)

### 3. Integration
The resulting datasets are stored in `ai/training_ready/data/generated/nightmare_hydrated` and mixed into the training corpus at a **5% ratio** (Golden Ratio for edge cases) to provide "emotional ballast" without overwhelming the baseline empathy models.

## Key Artifacts
- **Script**: `ai/training_ready/scripts/hydrate_nightmare_scenarios.py`
- **Output**: `ai/training_ready/data/generated/nightmare_hydrated/*.jsonl`
- **Validation**: 8-Gate Safety Check (Gate 7 specifically checks for toxicity vs. crisis realism).
