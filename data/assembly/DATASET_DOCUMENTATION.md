# Dataset Documentation

## Pixelated Empathy Training Dataset

### Overview
This dataset contains therapeutic conversations and clinical content for training AI models.

### Format
- ChatML-compliant JSONL
- Each sample contains a `messages` array with `role` and `content`

### Sources
- S3 final dataset
- Local therapeutic transcripts
- Converted clinical books
- Synthetic preference pairs

### Quality
- Deduplicated using SHA-256 content hash
- Repetition cleaned
- Clinical validity scored (0-1 scale)

### Version
2026.06.13
