# Quality Report

## Dataset Quality Summary

| Stage     | Samples |
|-----------|---------|
| Raw       | 118792  |
| Assembled | 118792  |
| Deduped   | 118792  |
| Clean     | 118792  |
| Scored    | 118792  |

## Quality Flags

- Exact duplicates: 0.0%
- Near duplicates: 0.0%
- Repetition: 0.0%
- Borderline: 99.1%

## Recommendations

### Include
- All book-converted samples (highest quality)
- S3 final_dataset samples with score >= 0.6
- Local therapeutic data with score >= 0.5
- Synthetic DPO samples with manual review

### Exclude
- Samples with score < 0.3
- Samples flagged for non-English content
- Exact duplicates

### Review
- Borderline samples (0.4-0.6) for annotation
- Synthetic nightmare fuel scenarios
- Low-scoring local therapeutic data
