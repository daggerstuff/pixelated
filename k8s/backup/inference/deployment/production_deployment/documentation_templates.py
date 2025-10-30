#!/usr/bin/env python3
"""
Documentation Templates and Generators - Task 5.5.3.1 Part 2

Template-based documentation generation system:
- Markdown documentation templates
- HTML documentation generation
- Interactive documentation with examples
- API documentation generation
- Usage guides and tutorials
"""

import json
import yaml
import markdown
from pathlib import Path
from typing import Dict, List, Any, Optional
from jinja2 import Template, Environment, FileSystemLoader
from datetime import datetime
import base64

from dataset_documentation import DatasetMetadata, SchemaField, ExportFormatDoc, QualityMetricDoc

class DocumentationTemplateManager:
    """Manages documentation templates and generation."""
    
    def __init__(self, output_dir: Path = None):
        self.output_dir = output_dir or Path("/home/vivi/pixelated/ai/docs")
        self.output_dir.mkdir(exist_ok=True)
        
        # Create templates directory
        self.templates_dir = Path(__file__).parent / "templates"
        self.templates_dir.mkdir(exist_ok=True)
        
        # Initialize Jinja2 environment
        self.jinja_env = Environment(
            loader=FileSystemLoader(str(self.templates_dir)),
            trim_blocks=True,
            lstrip_blocks=True
        )
        
        # Create default templates
        self._create_default_templates()
    
    def _create_default_templates(self):
        """Create default documentation templates."""
        
        # Main README template
        readme_template = """# {{ metadata.name }}

{{ metadata.description }}

## Overview

- **Version**: {{ metadata.version }}
- **Total Conversations**: {{ "{:,}".format(metadata.total_conversations) }}
- **Total Turns**: {{ "{:,}".format(metadata.total_turns) }}
- **Total Words**: {{ "{:,}".format(metadata.total_words) }}
- **Languages**: {{ metadata.languages | join(", ") }}
- **Quality Score Range**: {{ "%.3f"|format(metadata.quality_score_range.min) }} - {{ "%.3f"|format(metadata.quality_score_range.max) }}
- **Last Updated**: {{ metadata.last_updated.strftime("%Y-%m-%d") }}

## Dataset Sources

{% for source in metadata.sources %}
- `{{ source }}`
{% endfor %}

## Quality Tiers

{% for tier in metadata.tiers %}
- Tier {{ tier }}
{% endfor %}

## Export Formats

This dataset is available in multiple formats optimized for different use cases:

{% for format_name, format_doc in export_formats.items() %}
### {{ format_name.upper() }} Format

{{ format_doc.description }}

**Use Cases**: {{ format_doc.use_cases | join(", ") }}

**File Extension**: `.{{ format_doc.file_extension }}`

{% endfor %}

## Quality Metrics

{% for metric in quality_metrics %}
### {{ metric.metric_name }}

{{ metric.description }}

- **Range**: {{ metric.range.min }} - {{ metric.range.max }}
- **Calculation**: {{ metric.calculation_method }}
- **Interpretation**: {{ metric.interpretation }}

{% endfor %}

## Usage Examples

### Loading Data

```python
import json
import pandas as pd

# Load JSONL format
conversations = []
with open('dataset.jsonl', 'r') as f:
    for line in f:
        conversations.append(json.loads(line))

# Load CSV format
df = pd.read_csv('dataset.csv')
```

### Basic Analysis

```python
# Analyze conversation lengths
lengths = [len(conv['messages']) for conv in conversations]
print(f"Average conversation length: {sum(lengths) / len(lengths):.1f} turns")

# Quality distribution
quality_scores = [conv['quality_score'] for conv in conversations]
print(f"Average quality score: {sum(quality_scores) / len(quality_scores):.3f}")
```

## License

{{ metadata.license }}

## Contact

- **Organization**: {{ metadata.contact_info.organization }}
- **Email**: {{ metadata.contact_info.email }}
- **Website**: {{ metadata.contact_info.website }}

---

*Generated on {{ generation_date.strftime("%Y-%m-%d %H:%M:%S UTC") }}*
"""
        
        # Schema documentation template
        schema_template = """# Dataset Schema Documentation

## Overview

This document describes the schema for all export formats of the {{ metadata.name }} dataset.

{% for format_name, fields in schema_docs.items %}
## {{ format_name.upper() }} Format Schema

{% for field in fields %}
### `{{ field.name }}`

- **Type**: `{{ field.type }}`
- **Required**: {{ "Yes" if field.required else "No" }}
- **Description**: {{ field.description }}
- **Example**: `{{ field.example | tojson }}`
{% if field.constraints %}
- **Constraints**: {{ field.constraints | tojson }}
{% endif %}

{% if field.nested_fields %}
#### Nested Fields:
{% for nested_field in field.nested_fields %}
- **`{{ nested_field.name }}`** ({{ nested_field.type }}): {{ nested_field.description }}
  - Example: `{{ nested_field.example | tojson }}`
{% if nested_field.constraints %}
  - Constraints: {{ nested_field.constraints | tojson }}
{% endif %}
{% endfor %}
{% endif %}

{% endfor %}

### Example Record

```json
{{ example_records[format_name] | tojson(indent=2) }}
```

{% endfor %}

## Validation Rules

All exported data must pass the following validation rules:

1. **Required Fields**: All required fields must be present and non-null
2. **Data Types**: All fields must match their specified data types
3. **Constraints**: All field constraints must be satisfied
4. **Quality Scores**: Must be between 0.0 and 1.0
5. **Message Format**: Messages must have valid role and content fields
6. **UUID Format**: Conversation IDs must be valid UUID v4 format

## Schema Versioning

- **Current Version**: {{ metadata.schema_version }}
- **Compatibility**: Backward compatible with version 1.x
- **Migration**: Automatic migration available for older formats

---

*Generated on {{ generation_date.strftime("%Y-%m-%d %H:%M:%S UTC") }}*
"""
        
        # Quality metrics template
        quality_template = """# Quality Metrics Documentation

## Overview

The {{ metadata.name }} dataset includes comprehensive quality metrics for each conversation to help users select appropriate data for their use cases.

## Quality Metrics

{% for metric in quality_metrics %}
## {{ metric.metric_name }}

{{ metric.description }}

### Details

- **Range**: {{ metric.range.min }} to {{ metric.range.max }}
- **Calculation Method**: {{ metric.calculation_method }}
- **Interpretation**: {{ metric.interpretation }}

### Examples

{% for example in metric.examples %}
- **Score {{ example.score }}**: {{ example.interpretation }}
{% endfor %}

### Usage Recommendations

{% if metric.metric_name == "overall_quality" %}
- **High Quality (≥0.8)**: Suitable for production training and fine-tuning
- **Medium Quality (0.5-0.8)**: Good for general training with review
- **Low Quality (<0.5)**: May require filtering or additional processing
{% elif metric.metric_name == "safety_score" %}
- **High Safety (≥0.8)**: Safe for all applications
- **Medium Safety (0.5-0.8)**: Review recommended for sensitive applications
- **Low Safety (<0.5)**: Requires manual review before use
{% elif metric.metric_name == "therapeutic_accuracy" %}
- **High Accuracy (≥0.8)**: Excellent for therapeutic AI training
- **Medium Accuracy (0.5-0.8)**: Suitable for general conversational AI
- **Low Accuracy (<0.5)**: May not follow therapeutic best practices
{% endif %}

{% endfor %}

## Quality Filtering Examples

### Python Examples

```python
import json

# Load conversations
conversations = []
with open('dataset.jsonl', 'r') as f:
    for line in f:
        conversations.append(json.loads(line))

# Filter by overall quality
high_quality = [c for c in conversations if c['quality_score'] >= 0.8]
print(f"High quality conversations: {len(high_quality)}")

# Filter by safety score
safe_conversations = [c for c in conversations 
                     if c.get('metadata', {}).get('detailed_quality_metrics', {}).get('safety_score', 0) >= 0.8]

# Filter by multiple criteria
therapeutic_grade = [c for c in conversations 
                    if c['quality_score'] >= 0.8 
                    and c.get('metadata', {}).get('detailed_quality_metrics', {}).get('therapeutic_accuracy', 0) >= 0.7
                    and c.get('metadata', {}).get('detailed_quality_metrics', {}).get('safety_score', 0) >= 0.9]
```

### SQL Examples (for database access)

```sql
-- High quality conversations
SELECT * FROM conversations c
JOIN conversation_quality q ON c.conversation_id = q.conversation_id
WHERE q.overall_quality >= 0.8;

-- Safe and therapeutically accurate
SELECT * FROM conversations c
JOIN conversation_quality q ON c.conversation_id = q.conversation_id
WHERE q.safety_score >= 0.9 
  AND q.therapeutic_accuracy >= 0.7;

-- Quality distribution
SELECT 
  CASE 
    WHEN overall_quality >= 0.8 THEN 'High'
    WHEN overall_quality >= 0.5 THEN 'Medium'
    ELSE 'Low'
  END as quality_tier,
  COUNT(*) as count
FROM conversation_quality
GROUP BY quality_tier;
```

## Quality Assurance Process

1. **Automated Scoring**: Initial quality scores generated by ML models
2. **Human Review**: Sample validation by domain experts
3. **Continuous Monitoring**: Ongoing quality assessment and updates
4. **Feedback Integration**: User feedback incorporated into quality metrics

---

*Generated on {{ generation_date.strftime("%Y-%m-%d %H:%M:%S UTC") }}*
"""
        
        # Usage guide template
        usage_template = """# Usage Guide and Best Practices

## Getting Started

### Installation Requirements

```bash
pip install pandas numpy jsonlines
```

### Basic Usage

#### Loading the Dataset

```python
import json
import pandas as pd
import jsonlines

# Method 1: Load JSONL format
conversations = []
with jsonlines.open('pixelated_empathy_dataset.jsonl') as reader:
    for conversation in reader:
        conversations.append(conversation)

# Method 2: Load CSV format
df = pd.read_csv('pixelated_empathy_dataset.csv')

# Method 3: Load Parquet format (most efficient)
df = pd.read_parquet('pixelated_empathy_dataset.parquet')
```

#### Basic Analysis

```python
# Dataset overview
print(f"Total conversations: {len(conversations)}")
print(f"Average quality score: {sum(c['quality_score'] for c in conversations) / len(conversations):.3f}")

# Message statistics
total_messages = sum(len(c['messages']) for c in conversations)
print(f"Total messages: {total_messages}")
print(f"Average messages per conversation: {total_messages / len(conversations):.1f}")

# Quality distribution
quality_scores = [c['quality_score'] for c in conversations]
print(f"Quality score distribution:")
print(f"  Min: {min(quality_scores):.3f}")
print(f"  Max: {max(quality_scores):.3f}")
print(f"  Mean: {sum(quality_scores) / len(quality_scores):.3f}")
```

## Use Cases and Examples

### 1. Training Conversational AI Models

```python
# Prepare data for training
def prepare_training_data(conversations, min_quality=0.7):
    training_pairs = []
    
    for conv in conversations:
        if conv['quality_score'] >= min_quality:
            messages = conv['messages']
            for i in range(0, len(messages) - 1, 2):
                if i + 1 < len(messages):
                    user_msg = messages[i]['content']
                    assistant_msg = messages[i + 1]['content']
                    training_pairs.append({
                        'input': user_msg,
                        'output': assistant_msg,
                        'quality': conv['quality_score']
                    })
    
    return training_pairs

training_data = prepare_training_data(conversations)
print(f"Generated {len(training_data)} training pairs")
```

### 2. Fine-tuning OpenAI Models

```python
# Convert to OpenAI fine-tuning format
def convert_to_openai_format(conversations, output_file):
    with open(output_file, 'w') as f:
        for conv in conversations:
            if conv['quality_score'] >= 0.8:  # High quality only
                openai_format = {
                    "messages": conv['messages']
                }
                f.write(json.dumps(openai_format) + '\\n')

convert_to_openai_format(conversations, 'openai_training_data.jsonl')
```

### 3. Research and Analysis

```python
# Analyze therapeutic techniques
from collections import Counter

techniques = []
for conv in conversations:
    if 'therapeutic_techniques' in conv:
        techniques.extend(conv['therapeutic_techniques'])

technique_counts = Counter(techniques)
print("Most common therapeutic techniques:")
for technique, count in technique_counts.most_common(10):
    print(f"  {technique}: {count}")
```

### 4. Quality-based Filtering

```python
# Create quality-based subsets
def create_quality_subsets(conversations):
    subsets = {
        'premium': [],      # Quality >= 0.9
        'standard': [],     # Quality >= 0.7
        'basic': []         # Quality >= 0.5
    }
    
    for conv in conversations:
        quality = conv['quality_score']
        if quality >= 0.9:
            subsets['premium'].append(conv)
        elif quality >= 0.7:
            subsets['standard'].append(conv)
        elif quality >= 0.5:
            subsets['basic'].append(conv)
    
    return subsets

quality_subsets = create_quality_subsets(conversations)
for subset_name, subset_data in quality_subsets.items():
    print(f"{subset_name}: {len(subset_data)} conversations")
```

## Best Practices

### Data Quality

1. **Always check quality scores** before using conversations for training
2. **Filter by safety scores** for production applications
3. **Validate therapeutic accuracy** for healthcare-related applications
4. **Review conversation coherence** for dialogue systems

### Performance Optimization

1. **Use Parquet format** for large-scale analysis (fastest loading)
2. **Use JSONL format** for streaming processing
3. **Use CSV format** for compatibility with legacy systems
4. **Implement chunked processing** for memory efficiency

### Ethical Considerations

1. **Respect privacy**: All data has been anonymized and de-identified
2. **Use appropriate quality filters** for your application
3. **Consider bias implications** when selecting subsets
4. **Follow therapeutic guidelines** when using for healthcare applications

### Common Pitfalls

1. **Don't ignore quality scores** - they indicate data reliability
2. **Don't mix different quality tiers** without consideration
3. **Don't assume all conversations are suitable** for all use cases
4. **Don't skip validation** of your filtered datasets

## Integration Examples

### HuggingFace Datasets

```python
from datasets import Dataset

# Convert to HuggingFace format
def create_hf_dataset(conversations):
    data = {
        'conversation_id': [],
        'messages': [],
        'quality_score': []
    }
    
    for conv in conversations:
        data['conversation_id'].append(conv['conversation_id'])
        data['messages'].append(conv['messages'])
        data['quality_score'].append(conv['quality_score'])
    
    return Dataset.from_dict(data)

hf_dataset = create_hf_dataset(conversations)
```

### PyTorch DataLoader

```python
import torch
from torch.utils.data import Dataset, DataLoader

class ConversationDataset(Dataset):
    def __init__(self, conversations, tokenizer, max_length=512):
        self.conversations = conversations
        self.tokenizer = tokenizer
        self.max_length = max_length
    
    def __len__(self):
        return len(self.conversations)
    
    def __getitem__(self, idx):
        conv = self.conversations[idx]
        
        # Combine messages into single text
        text = ""
        for msg in conv['messages']:
            text += f"{msg['role']}: {msg['content']} "
        
        # Tokenize
        encoding = self.tokenizer(
            text,
            truncation=True,
            padding='max_length',
            max_length=self.max_length,
            return_tensors='pt'
        )
        
        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'quality_score': torch.tensor(conv['quality_score'], dtype=torch.float)
        }

# Usage
# dataset = ConversationDataset(conversations, tokenizer)
# dataloader = DataLoader(dataset, batch_size=32, shuffle=True)
```

## Support and Resources

- **Documentation**: Full API documentation available
- **Examples**: Additional examples in the `/examples` directory
- **Issues**: Report issues via GitHub or email
- **Updates**: Subscribe to notifications for dataset updates

---

*Generated on {{ generation_date.strftime("%Y-%m-%d %H:%M:%S UTC") }}*
"""
        
        # Save templates
        templates = {
            'readme.md': readme_template,
            'schema.md': schema_template,
            'quality_metrics.md': quality_template,
            'usage_guide.md': usage_template
        }
        
        for filename, template_content in templates.items():
            template_file = self.templates_dir / filename
            with open(template_file, 'w', encoding='utf-8') as f:
                f.write(template_content)
    
    def generate_documentation(self, metadata: DatasetMetadata, 
                             schema_docs: Dict[str, List[SchemaField]],
                             quality_metrics: List[QualityMetricDoc],
                             export_formats: Dict[str, ExportFormatDoc] = None) -> Dict[str, Path]:
        """Generate all documentation files."""
        
        # Prepare template context
        context = {
            'metadata': metadata,
            'schema_docs': schema_docs,
            'quality_metrics': quality_metrics,
            'export_formats': export_formats or {},
            'generation_date': datetime.utcnow(),
            'example_records': self._generate_example_records(schema_docs)
        }
        
        generated_files = {}
        
        # Generate each documentation file
        templates = ['readme.md', 'schema.md', 'quality_metrics.md', 'usage_guide.md']
        
        for template_name in templates:
            try:
                template = self.jinja_env.get_template(template_name)
                content = template.render(**context)
                
                output_file = self.output_dir / template_name
                with open(output_file, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                generated_files[template_name] = output_file
                
            except Exception as e:
                print(f"Error generating {template_name}: {e}")
        
        return generated_files
    
    def _generate_example_records(self, schema_docs: Dict[str, List[SchemaField]]) -> Dict[str, Dict]:
        """Generate example records for each format."""
        examples = {}
        
        # Base example data
        base_messages = [
            {"role": "user", "content": "I'm feeling anxious about my upcoming presentation at work."},
            {"role": "assistant", "content": "I understand that presentations can be anxiety-provoking. Let's explore some strategies to help you feel more confident and prepared."}
        ]
        
        base_metadata = {
            "dataset_source": "professional_psychology",
            "tier": 2,
            "language": "en",
            "created_at": "2025-08-03T14:30:00Z",
            "detailed_quality_metrics": {
                "overall_quality": 0.85,
                "therapeutic_accuracy": 0.80,
                "clinical_compliance": 0.90,
                "safety_score": 0.95,
                "conversation_coherence": 0.85,
                "emotional_authenticity": 0.80
            }
        }
        
        # Generate format-specific examples
        examples['jsonl'] = {
            "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
            "messages": base_messages,
            "quality_score": 0.85,
            "metadata": base_metadata,
            "tags": ["anxiety", "presentation", "workplace"],
            "categories": ["mental_health"],
            "therapeutic_techniques": ["cognitive_behavioral_therapy", "exposure_therapy"]
        }
        
        examples['csv'] = {
            "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
            "messages_json": json.dumps(base_messages),
            "quality_score": 0.85,
            "metadata_json": json.dumps(base_metadata),
            "tags_json": json.dumps({
                "tags": ["anxiety", "presentation", "workplace"],
                "categories": ["mental_health"],
                "therapeutic_techniques": ["cognitive_behavioral_therapy"]
            })
        }
        
        examples['parquet'] = examples['csv']  # Same as CSV
        examples['huggingface'] = examples['jsonl']  # Same as JSONL
        
        examples['openai'] = {
            "messages": base_messages,
            "conversation_id": "550e8400-e29b-41d4-a716-446655440000"
        }
        
        return examples

def main():
    """Test documentation template generation."""
    print("📝 DOCUMENTATION TEMPLATE MANAGER - Task 5.5.3.1 Part 2")
    print("=" * 60)
    
    # Initialize template manager
    template_manager = DocumentationTemplateManager()
    
    print("✅ Documentation template system initialized")
    print(f"   Templates directory: {template_manager.templates_dir}")
    print(f"   Output directory: {template_manager.output_dir}")
    print("✅ Default templates created:")
    print("   - readme.md")
    print("   - schema.md") 
    print("   - quality_metrics.md")
    print("   - usage_guide.md")
    
    print("\n📚 Documentation template system ready for generation!")

if __name__ == "__main__":
    main()
