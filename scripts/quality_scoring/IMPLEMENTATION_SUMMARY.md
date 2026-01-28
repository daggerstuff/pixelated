# Quality Scoring v1 Implementation Summary

**Status**: ✅ Complete  
**Date**: 2025-12-18  
**Related Issue**: KAN-12  
**Epic**: KAN-1 (Governance & Licensing) - Ingestion & Quality Scoring

---

## Overview

Production-quality implementation of Quality Scoring v1 for the Dataset Expansion project. The system computes four key signals (empathy, fidelity, harm, domain) and provides accept/curate/reject decisions for dataset quality filtering.

---

## Implementation Components

### 1. Production Signal Computation ✅

**File**: `scripts/quality_scoring/production_scoring.py`

- **Empathy Detection**: Uses `EmpathyMentalHealthValidator` patterns for empathy scoring
  - Detects supportive language, emotional validation, understanding expressions
  - Penalizes dismissive or minimizing language
  - Fallback to keyword-based heuristics when validators unavailable

- **Fidelity Scoring**: Clinical authenticity assessment
  - Detects and penalizes pseudo-clinical claims ("guaranteed cure", "miracle treatment")
  - Rewards evidence-based therapeutic language
  - Pattern-based detection of inappropriate claims

- **Domain Relevance**: Therapeutic/mental health relevance scoring
  - Multi-category keyword matching (emotions, therapeutic terms, mental health, techniques)
  - Higher scores for diverse category presence
  - Normalized scoring based on keyword density

- **Harmfulness Detection**: Safety and harm detection
  - Uses `SafetyEthicsValidator` patterns when available
  - Detects self-harm, violence, crisis content
  - Pattern-based detection with severity weighting

### 2. Enhanced Scoring Interface ✅

**File**: `scripts/quality_scoring/scoring_interface.py`

- Automatic fallback from production to heuristics
- Maintains backward compatibility with stub interface
- Composes scores with configurable weights
- Three-tier decision system (accept/curate/reject) with configurable thresholds

### 3. Pipeline Integration ✅

**File**: `scripts/quality_scoring/pipeline_integration.py`

- `score_conversation_text()`: Score single text samples
- `score_jsonl_file()`: Batch scoring for JSONL files
- `filter_by_decision()`: Filter scored results by decision

### 4. CLI Tool ✅

**File**: `scripts/quality_scoring/run_stub.py`

- Command-line interface for scoring JSONL files
- Configurable weights and thresholds via JSON config
- Input/Output JSONL format support

### 5. Documentation ✅

**Files**:
- `README.md` - Complete usage documentation
- `IMPLEMENTATION_SUMMARY.md` - This file
- `config.example.json` - Example configuration

---

## Files Created/Modified

1. `scripts/quality_scoring/production_scoring.py` - **NEW** - Production signal computation
2. `scripts/quality_scoring/scoring_interface.py` - **MODIFIED** - Enhanced with production fallback
3. `scripts/quality_scoring/pipeline_integration.py` - **NEW** - Pipeline integration helpers
4. `scripts/quality_scoring/README.md` - **UPDATED** - Complete documentation
5. `scripts/quality_scoring/IMPLEMENTATION_SUMMARY.md` - **NEW** - Implementation summary

---

## Usage Examples

### Basic Usage

```python
from scripts.quality_scoring.scoring_interface import compute_signals, compose_score

# Compute signals
signals = compute_signals("Thank you for sharing. I understand this is difficult.")

# Compose score with default weights/thresholds
result = compose_score(
    signals,
    weights={"empathy": 0.25, "fidelity": 0.25, "domain": 0.25, "harm": 0.25},
    thresholds={"harm_max": 0.05, "accept_min": 0.60, "curate_min": 0.45}
)

print(f"Decision: {result.decision}, Composite: {result.composite:.2f}")
```

### Pipeline Integration

```python
from scripts.quality_scoring.pipeline_integration import score_jsonl_file

# Score entire JSONL file
count = score_jsonl_file(
    input_path="input.jsonl",
    output_path="scored.jsonl",
    config_path="config.json"
)
```

### CLI Usage

```bash
# Score a JSONL file
python scripts/quality_scoring/run_stub.py \
    --in input.jsonl \
    --out output.jsonl \
    --config config.example.json
```

---

## Signal Descriptions

### Empathy [0,1]
- **Purpose**: Measure empathetic communication
- **Method**: Pattern matching using `EmpathyMentalHealthValidator` indicators
- **Key Patterns**:
  - Emotional reactions: "I understand", "that sounds difficult"
  - Interpretations: References to feelings/situation
  - Explorations: Probing questions
  - Validation: "It's okay to feel", "You're not alone"
- **Penalties**: Dismissive language ("just get over it", "it's not that bad")

### Fidelity [0,1]
- **Purpose**: Clinical authenticity and evidence-based practice
- **Method**: Pattern-based detection of pseudo-clinical claims
- **Red Flags**: "guaranteed cure", "miracle treatment", "100% effective"
- **Rewards**: Evidence-based language, appropriate therapeutic terms

### Domain [0,1]
- **Purpose**: Therapeutic/mental health relevance
- **Method**: Multi-category keyword matching
- **Categories**: Emotions, therapeutic terms, mental health topics, techniques
- **Scoring**: Higher scores for diverse category presence

### Harm [0,1] (higher = worse)
- **Purpose**: Safety and harmfulness detection
- **Method**: Pattern-based detection using safety validators
- **Patterns**: Self-harm, violence, crisis content, harmful dismissive language
- **Severity**: Weighted by pattern type and context

---

## Decision Logic

The system uses a three-tier decision system:

1. **Reject**: `harm > harm_max` OR `composite < curate_min`
2. **Curate**: `composite >= curate_min` AND `composite < accept_min`
3. **Accept**: `composite >= accept_min` AND `harm <= harm_max`

**Default Thresholds**:
- `harm_max`: 0.05 (reject if harm > 0.05)
- `accept_min`: 0.60 (accept if composite >= 0.60)
- `curate_min`: 0.45 (curate if composite >= 0.45)

**Default Weights**:
- `empathy`: 0.25
- `fidelity`: 0.25
- `domain`: 0.25
- `harm`: 0.25 (inverted in composite: lower harm = better)

---

## Integration Points

### Dataset Pipeline Integration

The quality scoring can be integrated into:

1. **Dataset Ingestion**: Score incoming datasets during ingestion
2. **Quality Gates**: Use as a quality filter in pipeline orchestrators
3. **Post-Processing**: Filter datasets after processing
4. **Quality Monitoring**: Track quality scores over time

### Example Integration

```python
from scripts.quality_scoring.pipeline_integration import score_conversation_text

def quality_gate(conversation_text: str) -> bool:
    """Quality gate using scoring system."""
    result = score_conversation_text(conversation_text)
    return result["decision"] in ("accept", "curate")
```

---

## Configuration

Configuration is done via JSON file with weights and thresholds:

```json
{
  "weights": {
    "empathy": 0.25,
    "fidelity": 0.25,
    "domain": 0.25,
    "harm": 0.25
  },
  "thresholds": {
    "harm_max": 0.05,
    "accept_min": 0.60,
    "curate_min": 0.45
  }
}
```

---

## Testing

The system has been tested with:
- ✅ Basic signal computation
- ✅ Production/fallback logic
- ✅ JSONL file processing
- ✅ Decision logic with various thresholds

**Test Results**:
- Empathy detection: Working with fallback heuristics
- Fidelity scoring: Correctly identifies pseudo-clinical claims
- Domain relevance: Properly scores therapeutic content
- Harm detection: Accurately flags harmful content

---

## Next Steps

1. **Integration**: Integrate into dataset pipeline orchestrators
2. **Validation**: Validate against human-labeled quality scores
3. **Calibration**: Fine-tune weights and thresholds based on empirical data
4. **Monitoring**: Add quality score tracking and reporting
5. **Enhancement**: Consider ML-based enhancements for improved accuracy

---

## Related Documentation

- **Jira Issue**: [KAN-12](https://ratchetaf.atlassian.net/browse/KAN-12)
- **Confluence Spec**: Ingestion & Quality Scoring child page
- **Action Plan**: `.notes/dataset-expansion-decision/01-ACTION-PLAN.md`
- **Production Validators**: `ai/dataset_pipeline/quality/`

---

**Implementation Complete** ✅  
Ready for integration into dataset pipeline and quality gates.
