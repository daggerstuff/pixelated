# AI Folder Reorganization Mappings

This document shows how files and directories were reorganized in the AI folder.

## Path Mappings

| Old Path | New Path | Category |
|----------|----------|----------|
| `ai/core/extract_features` | `ai/training/extract_features` | Training Modules |
| `ai/core/extract_features_from_samples` | `ai/training/extract_features_from_samples` | Training Modules |
| `ai/core/extract_small_sample` | `ai/training/extract_small_sample` | Training Modules |
| `ai/core/combine_datasets` | `ai/data/combine_datasets` | Data Processing |
| `ai/core/generate_prompts` | `ai/training/generate_prompts` | Training Modules |
| `ai/core/generate_synthetic` | `ai/training/generate_synthetic` | Training Modules |
| `ai/pipelines/dataset_pipeline` | `ai/pipelines/dataset_pipeline` | Pipelines |
| `ai/pipelines/edge_case_pipeline_standalone` | `ai/pipelines/edge_case_pipeline_standalone` | Pipelines |
| `ai/pipelines/dual_persona_training` | `ai/pipelines/dual_persona_training` | Pipelines |
| `ai/pipelines/youtube-transcription-pipeline` | `ai/pipelines/youtube-transcription-pipeline` | Pipelines |
| `ai/datasets/...` | `ai/data/` | Data Storage |
| `ai/datasets/data` | `ai/data/raw/` | Raw Data |
| `ai/datasets/empathetic_dialogues` | `ai/data/processed/empathetic_dialogues` | Processed Datasets |
| `ai/datasets/therapy-bot-data-10k` | `ai/data/processed/therapy-bot-data-10k` | Processed Datasets |
| `ai/datasets/generated` | `ai/data/processed/generated` | Generated Data |
| `ai/datasets/generated_dialogues` | `ai/data/processed/generated_dialogues` | Generated Dialogues |
| `ai/datasets/nltk_data` | `ai/data/processed/nltk_data` | NLP Data |
| `ai/models/ClimbMix` | `ai/models/ClimbMix` | Models |
| `ai/models/MERTools` | `ai/models/MERTools` | Models |
| `ai/models/ConvLab-3` | `ai/models/ConvLab-3` | Models |
| `ai/models/Syn-R1` | `ai/training/Syn-R1` | Training Models |
| `ai/models/pixel` | `ai/training/pixel` | Training Models |
| `ai/scripts/synthetic_dashboard` | `ai/scripts/synthetic_dashboard` | Scripts |
| `ai/legacy/Wendy` | `ai/legacy/Wendy` | Legacy |
| `ai/legacy/Wendy-master` | `ai/legacy/Wendy-master` | Legacy |
| `ai/legacy/1.PsychologyTest` | `ai/legacy/1.PsychologyTest` | Legacy |
| `ai/legacy/6-2-leftovers` | `ai/legacy/6-2-leftovers` | Legacy |
| `ai/legacy/prompts` | `ai/legacy/prompts` | Legacy |
| `ai/legacy/quality_reports` | `ai/legacy/quality_reports` | Legacy |

## Update Instructions

If you encounter import errors after this reorganization:

1. **Python imports**: Update `from ai.module` to `from ai.category.module`
2. **TypeScript imports**: Update relative paths to match new structure
3. **Documentation links**: Update file references in README and docs
4. **Configuration files**: Update paths in config files

## Examples

### Python Import Updates
```python
# Old
from ai.pipelines.dataset_pipeline import something

# New  
from ai.pipelines.dataset_pipeline import something
```

### TypeScript Import Updates
```typescript
// Old
import { Something } from '../ai/models/types'

// New
import { Something } from '../ai/models/models/types'
```

---
*Generated automatically during AI folder reorganization*
