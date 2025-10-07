# Psychology Knowledge Integration Pipeline (5.0) - Complete Walkthrough

This guide demonstrates the complete end-to-end psychology knowledge integration pipeline, from raw clinical knowledge to balanced, validated conversational training data.

## 🚀 Quick Start

```bash
# Run the complete pipeline with defaults
python scripts/psychology_pipeline_demo.py

# Run with custom settings
python scripts/psychology_pipeline_demo.py --output-dir ./my_output --target-total 100
```

## 📋 Pipeline Overview

The psychology knowledge integration pipeline consists of 7 sequential steps:

1. **Parse Psychology Knowledge** - Structure DSM-5, PDM-2, and Big Five data
2. **Generate Client Scenarios** - Create realistic client backgrounds and presenting problems
3. **Convert to Conversations** - Transform knowledge into therapeutic dialogue format
4. **Generate Therapeutic Responses** - Create evidence-based therapeutic responses
5. **Validate Clinical Accuracy** - Ensure clinical safety and accuracy
6. **Balance Knowledge Categories** - Achieve target ratios across knowledge domains
7. **Generate Final Report** - Comprehensive pipeline results and statistics

## 🔧 Step-by-Step Breakdown

### Step 1: Parse Psychology Knowledge 📚

**What it does:**
- Parses DSM-5 diagnostic criteria into structured format
- Extracts PDM-2 psychodynamic frameworks and attachment styles  
- Processes Big Five personality assessments and clinical guidelines

**Outputs:**
- `01_dsm5_disorders.json` - Structured diagnostic criteria
- `01_pdm2_framework.json` - Psychodynamic patterns and attachment styles
- `01_bigfive_data.json` - Personality factors and clinical guidelines

**Key Components:**
```python
from ai.pipelines.dataset_pipeline.dsm5_parser import DSM5Parser
from ai.pipelines.dataset_pipeline.pdm2_parser import PDM2Parser  
from ai.pipelines.dataset_pipeline.bigfive_processor import BigFiveProcessor
```

### Step 2: Generate Client Scenarios 👥

**What it does:**
- Creates realistic client backgrounds (demographics, history, context)
- Generates presenting problems based on psychology knowledge
- Develops clinical formulations and treatment goals

**Outputs:**
- `02_client_scenarios.json` - Complete client scenarios with backgrounds and problems

**Key Components:**
```python
from ai.pipelines.dataset_pipeline.client_scenario_generator import ClientScenarioGenerator
```

### Step 3: Convert to Conversations 💬

**What it does:**
- Transforms psychology knowledge into therapeutic dialogue format
- Creates client-therapist exchanges based on clinical scenarios
- Generates multiple conversation types (assessment, diagnostic, therapeutic)

**Outputs:**
- `03_therapeutic_conversations.json` - Structured therapeutic conversations

**Key Components:**
```python
from ai.pipelines.dataset_pipeline.psychology_conversation_converter import PsychologyConversationConverter
```

### Step 4: Generate Therapeutic Responses 🩺

**What it does:**
- Creates evidence-based therapeutic responses for different scenarios
- Applies multiple therapeutic approaches (CBT, psychodynamic, humanistic, etc.)
- Includes clinical rationale and contraindications for each response

**Outputs:**
- `04_therapeutic_responses.json` - Therapeutic responses with clinical context

**Key Components:**
```python
from ai.dataset_pipeline.therapeutic_response_generator import TherapeuticResponseGenerator
```

### Step 5: Validate Clinical Accuracy ✅

**What it does:**
- Validates conversations against clinical standards and safety requirements
- Checks diagnostic accuracy, therapeutic appropriateness, and ethical compliance
- Identifies critical issues and provides improvement recommendations

**Outputs:**
- `05_clinical_validation.json` - Detailed validation results and quality scores

**Key Components:**
```python
from ai.dataset_pipeline.clinical_accuracy_validator import ClinicalAccuracyValidator
```

### Step 6: Balance Knowledge Categories ⚖️

**What it does:**
- Categorizes content into knowledge domains (DSM-5, attachment, personality, etc.)
- Balances categories according to target ratios (30/25/20/15/10)
- Ensures quality thresholds are met across all categories

**Outputs:**
- `06_category_balancing.json` - Category balance report with recommendations

**Key Components:**
```python
from ai.dataset_pipeline.knowledge_category_balancer import KnowledgeCategoryBalancer
```

### Step 7: Generate Final Report 📊

**What it does:**
- Compiles comprehensive pipeline statistics and results
- Creates human-readable summary of the entire process
- Lists all generated files and their purposes

**Outputs:**
- `07_FINAL_PIPELINE_REPORT.json` - Complete pipeline results
- `07_PIPELINE_SUMMARY.txt` - Human-readable summary

## 📁 Output Structure

After running the pipeline, you'll have:

```text
psychology_pipeline_output/
├── 01_dsm5_disorders.json           # Structured DSM-5 diagnostic criteria
├── 01_pdm2_framework.json           # PDM-2 psychodynamic frameworks  
├── 01_bigfive_data.json             # Big Five personality data
├── 02_client_scenarios.json         # Generated client scenarios
├── 03_therapeutic_conversations.json # Therapeutic conversations
├── 04_therapeutic_responses.json    # Evidence-based responses
├── 05_clinical_validation.json      # Clinical accuracy validation
├── 06_category_balancing.json       # Knowledge category balancing
├── 07_FINAL_PIPELINE_REPORT.json   # Complete pipeline report
└── 07_PIPELINE_SUMMARY.txt          # Human-readable summary
```

## 🎯 Key Metrics and Quality Assurance

The pipeline tracks several important metrics:

- **Knowledge Coverage**: DSM-5 disorders, attachment styles, personality factors
- **Content Generation**: Scenarios, conversations, therapeutic responses  
- **Quality Assurance**: Validation scores, approval rates, critical issues
- **Category Balance**: Target ratios, quality scores, recommendations

## 🔧 Customization Options

### Target Total Items
```bash
python scripts/psychology_pipeline_demo.py --target-total 200
```

### Custom Output Directory
```bash
python scripts/psychology_pipeline_demo.py --output-dir ./custom_output
```

### Balancing Strategy
The pipeline supports different balancing strategies:
- `quality_first` - Prioritize quality over quantity
- `balanced` - Balance quality and category targets (default)
- `quantity_focused` - Prioritize meeting category targets

## 📊 Expected Results

A successful pipeline run should produce:

- **50+ balanced training items** (or your target total)
- **80%+ approval rate** for clinical validation
- **Balanced category distribution** according to target ratios
- **Comprehensive quality metrics** across all components

## 🚨 Troubleshooting

### Common Issues

1. **Import Errors**: Ensure you're running from the project root directory
2. **Missing Dependencies**: Install required packages from `requirements.txt`
3. **Low Quality Scores**: Review clinical validation recommendations
4. **Category Imbalance**: Adjust generation parameters or target ratios

### Debug Mode

For detailed debugging, modify the script to include more verbose logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## 🎉 Success Indicators

Your pipeline run is successful when you see:

- ✅ All 7 steps completed without errors
- ✅ High approval rate (>70%) for clinical validation  
- ✅ Balanced category distribution within target ranges
- ✅ Comprehensive final report with quality metrics

## 🔄 Next Steps

After running the pipeline:

1. **Review the final report** for quality metrics and recommendations
2. **Examine category balance** and adjust if needed
3. **Use the generated data** for AI model training
4. **Iterate and improve** based on validation feedback

## 📚 Related Documentation

- [DSM-5 Parser Documentation](../ai/pipelines/dataset_pipeline/dsm5_parser.py)
- [Clinical Validation Guidelines](../ai/pipelines/dataset_pipeline/clinical_accuracy_validator.py)
- [Category Balancing Configuration](../ai/pipelines/dataset_pipeline/knowledge_category_balancer.py)

---

🧠 **Psychology Knowledge Integration Pipeline (5.0)** - Complete end-to-end solution for creating high-quality, clinically accurate, and properly balanced therapeutic training datasets.