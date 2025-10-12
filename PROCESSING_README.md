# Mental Health Dataset Processing Pipeline

This pipeline converts the downloaded mental health datasets into ChatML format for training conversational AI models focused on mental health support.

## Overview

The pipeline processes 19,730 conversations from various mental health datasets including:
- Relationship counseling and heartbreak support (9,846 conversations)
- Complex trauma education transcripts (24 conversations) 
- Mental health counseling conversations (14 conversations)

## Files

- `process_pipeline.py` - Main processing script that converts data to ChatML format
- `train_example.py` - Example script showing how to prepare data for training
- `processed/mental_health_chatml.jsonl` - All conversations in ChatML format
- `processed/splits/` - Train/validation/test splits ready for training

## Usage

### 1. Process the raw data
```bash
uv run python process_pipeline.py
```

### 2. Create training splits
```bash
uv run python train_example.py
```

## Data Format

The processed data uses ChatML format with three types of system messages:

1. **Relationship Counseling** (19,692 conversations)
   - System: "You are a compassionate mental health counselor specializing in relationship issues and emotional support. Provide empathetic, evidence-based guidance."

2. **Trauma Education** (24 conversations)  
   - System: "You are a mental health professional providing education about trauma and healing. Explain concepts clearly and compassionately."

3. **General Mental Health** (14 conversations)
   - System: "You are a mental health educator providing insights about complex trauma and healing. Share knowledge in an accessible, supportive way."

## Example Conversation

```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are a compassionate mental health counselor specializing in relationship issues and emotional support. Provide empathetic, evidence-based guidance."
    },
    {
      "role": "user", 
      "content": "How can understanding the stages of grief help someone cope with the loss of a romantic relationship?"
    },
    {
      "role": "assistant",
      "content": "Understanding the stages of grief provides a framework for normalizing the complex emotions associated with loss..."
    }
  ]
}
```

## Training Splits

- **Training**: 15,784 conversations (80%)
- **Validation**: 1,973 conversations (10%) 
- **Test**: 1,973 conversations (10%)

## Data Sources

The processed data comes from:
- CoT Heartbreak and Breakups dataset (9.8k conversations)
- Complex trauma educational transcripts 
- Mental health counseling conversation datasets
- Whisper-transcribed mental health audio content

## Next Steps

The processed data is ready for:
1. Fine-tuning language models for mental health support
2. Training conversational AI systems
3. Developing empathetic chatbots for therapeutic applications

All data maintains focus on providing compassionate, evidence-based mental health guidance while respecting ethical boundaries of AI-assisted therapy.
