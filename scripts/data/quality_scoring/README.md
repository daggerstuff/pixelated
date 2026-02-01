Quality Scoring v1 – Production Implementation

Purpose
- Production-quality quality scoring system for dataset expansion project (KAN-12)
- Computes four key signals: empathy, fidelity, harm, domain relevance
- Provides accept/curate/reject decisions based on configurable thresholds

Files
- config.example.json – example weights and thresholds
- scoring_interface.py – main interface with production/fallback logic
- production_scoring.py – production-quality signal computation using quality frameworks
- run_stub.py – CLI tool for scoring JSONL files
- example_output.jsonl – sample line-delimited scoring output format

Signals

1. **Empathy** [0,1]
   - Measures empathetic communication using EmpathyMentalHealthValidator
   - Detects supportive language, emotional validation, understanding
   - Penalizes dismissive or minimizing language

2. **Fidelity** [0,1]
   - Clinical authenticity and evidence-based practice
   - Penalizes pseudo-clinical claims ("guaranteed cure", "miracle treatment")
   - Rewards appropriate therapeutic language

3. **Domain** [0,1]
   - Therapeutic/mental health relevance
   - Detects therapeutic terms, mental health topics, therapeutic techniques
   - Higher scores for multi-category presence

4. **Harm** [0,1] (higher = worse
   - Safety and harmfulness detection
   - Detects self-harm, violence, crisis content
   - Uses SafetyEthicsValidator when available

Production Features
- Uses existing quality assessment frameworks (EmpathyMentalHealthValidator, SafetyEthicsValidator)
- Fallback heuristics when production components unavailable
- Configurable weights and thresholds via config.json
- Three-tier decision system: accept, curate, reject

Usage

```bash
# Score a JSONL file
python scripts/quality_scoring/run_stub.py \
    --in input.jsonl \
    --out output.jsonl \
    --config scripts/quality_scoring/config.example.json
```

Integration
- Integrates with dataset pipeline quality assessment frameworks
- Can be called programmatically via `compute_signals()` and `compose_score()`
- Ready for integration into orchestrators and quality gates

Related
- KAN-12: https://ratchetaf.atlassian.net/browse/KAN-12
- Confluence Spec: Ingestion & Quality Scoring child page
- Production validators: `ai/dataset_pipeline/quality/`
