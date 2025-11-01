# pixelated_ai_v20250803_053213_q50_t2_f3

## Production Dataset Release

**Release Date**: 2025-08-03 09:32:13 UTC  
**Total Conversations**: 3  
**Quality Threshold**: 0.5  
**Included Tiers**: priority_1, professional  

## Dataset Splits

- **Training**: 0 conversations (60.0%)
- **Validation**: 1 conversations (20.0%)
- **Testing**: 2 conversations (20.0%)

## Export Formats

- **JSONL**: Available for all splits
- **CSV**: Available for all splits
- **HUGGINGFACE**: Available for all splits

## Quality Distribution

### Training Set


### Validation Set
- high: 100.0%

### Test Set
- high: 100.0%

## Directory Structure

```
pixelated_ai_v20250803_053213_q50_t2_f3/
├── README.md                 # This file
├── deployment_config.json    # Deployment configuration
├── splits/                   # Dataset split definitions
│   └── v*/                   # Split version directory
├── datasets/                 # Exported datasets
│   ├── train/               # Training data in all formats
│   ├── validation/          # Validation data in all formats
│   └── test/                # Test data in all formats
└── documentation/           # Additional documentation
```

## Usage Examples

### Loading JSONL Format
```python
import json

# Load training data
with open('datasets/train/train.jsonl', 'r') as f:
    train_data = [json.loads(line) for line in f]
```

### Loading HuggingFace Format
```python
from datasets import load_dataset

# Load dataset
dataset = load_dataset('json', data_files={
    'train': 'datasets/train/train_hf.jsonl',
    'validation': 'datasets/validation/validation_hf.jsonl',
    'test': 'datasets/test/test_hf.jsonl'
})
```

### Loading OpenAI Format
```python
import json

# Load for OpenAI fine-tuning
with open('datasets/train/train_openai.jsonl', 'r') as f:
    openai_data = [json.loads(line) for line in f]
```

## Quality Assurance

- ✅ All conversations meet minimum quality threshold (0.5)
- ✅ Stratified sampling maintains quality distribution across splits
- ✅ All export formats validated for consistency
- ✅ No data leakage between train/validation/test splits

## Contact

For questions about this dataset release, please refer to the Pixelated AI documentation.
