---
title: "Mental Health Datasets Guide"
description: "Mental Health Datasets Guide documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation"]
draft: false
toc: true
---

# Mental Health Datasets Guide

This guide explains how to use the dataset merging and fine-tuning preparation tools included in this project. These tools allow you to merge multiple mental health conversational datasets and prepare them for fine-tuning various AI models.

## Available Datasets

The dataset merger includes the following datasets:

1. **HumanLLMs/Human-Like-DPO-Dataset** - A dataset of human-like conversations used for Direct Preference Optimization
2. **Amod/mental_health_counseling_conversations** - A dataset of mental health counseling conversations
3. **marcelbinz/Psych-101** - A psychology educational dataset covering various topics
4. **MentalChat16K** - A comprehensive benchmark dataset for conversational mental health assistance
5. **RedditESS** - A dataset of mental health social support interactions from Reddit
6. **TRACE** - A mental health clinical dataset
7. **Depression-Reddit-Cleaned** - A cleaned version of a Reddit depression dataset

## Prerequisites

Before using the dataset tools, you'll need to install the required Python dependencies:

```bash
pnpm merge-datasets:install
```

This will:
- Check your Python installation (requires Python 3.8+)
- Create a virtual environment for isolated dependencies
- Install necessary packages including `datasets`, `pandas`, `transformers`, `torch`, and other requirements
- Set up NLP tools like spaCy for text processing

## Merging Datasets

To merge all the mental health datasets into a single normalized format, run:

```bash
pnpm merge-datasets
```

This will:
1. Download all the datasets from their sources
2. Normalize them into a consistent format
3. Merge them into a single dataset
4. Save the merged dataset to the `datasets` directory
5. Display statistics about the merged dataset

The merged dataset will be saved in the following formats:
- JSON: `datasets/merged_mental_health_dataset.json`
- CSV: `datasets/merged_mental_health_dataset.csv`

## Preparing Datasets for Fine-Tuning

After merging the datasets, you can prepare them for fine-tuning various AI models:

### OpenAI Fine-Tuning Format

To prepare the dataset for OpenAI fine-tuning (in JSONL format):

```bash
pnpm prepare-openai
```

This will create `datasets/mental_health_openai.jsonl` with the data formatted according to OpenAI's fine-tuning requirements. Each entry includes:
- A system message defining the assistant's role
- The user's input
- The expected assistant response

### Hugging Face Transformers Format

To prepare the dataset for Hugging Face Transformers models:

```bash
pnpm prepare-huggingface
```

This will create `datasets/mental_health_huggingface` directory containing:
- The dataset in Arrow format
- A CSV version for inspection: `dataset.csv`
- Train split (80%): `train` directory
- Validation split (20%): `validation` directory

The Hugging Face format includes fields for instruction, input, output, source, and tags, making it suitable for instruction-tuning and supervised fine-tuning of transformer models.

### Preparing All Formats

To prepare the dataset in all supported formats at once:

```bash
pnpm prepare-all-formats
```

## API Endpoints

The system provides comprehensive API endpoints for dataset operations:

### Dataset Merging Operations

#### Check Dataset Status
```
GET /api/ai/data/merge
```

Returns whether the merged dataset exists and its path.

#### Merge Datasets
```
POST /api/ai/data/merge
```

Parameters:
- `force` (boolean, optional): Whether to recreate the dataset if it already exists.

Headers:
- `Authorization`: Bearer token for authentication

Response:
- Success response with dataset statistics
- Error response if the operation failed

### Dataset Preparation Operations

#### Check Preparation Status
```
GET /api/ai/data/prepare
```

Returns the status of prepared datasets for different formats.

#### Prepare Datasets
```
POST /api/ai/data/prepare
```

Parameters:
- `format` (string, optional): Format to prepare ("openai", "huggingface", or "all"). Default is "all".
- `force` (boolean, optional): Whether to recreate the datasets if they already exist.

Headers:
- `Authorization`: Bearer token for authentication

Response:
- Success response with paths to the prepared datasets
- Error response if the operation failed

## Command-Line Interface

The project includes a comprehensive CLI tool for dataset operations. When running `pnpm merge-datasets`, you'll be guided through the process with:

- Clear instructions and progress updates
- Confirmation prompts before overwriting existing data
- Detailed statistics after merging
- Source distribution information
- Tag distribution analysis

## Programmatic Usage

You can also use the dataset tools programmatically in your code:

```typescript
import {
  mergeAllDatasets,
  mergedDatasetExists,
  getMergedDatasetPath
} from './src/lib/ai/data/merge-datasets';

import {
  prepareForOpenAI,
  prepareForHuggingFace,
  prepareAllFormats,
  preparedDatasetsExist
} from './src/lib/ai/data/prepare-fine-tuning';

// Check if datasets already exist
const datasetExists = mergedDatasetExists();
const preparedStatus = preparedDatasetsExist();
console.log('Dataset exists:', datasetExists);
console.log('Prepared formats:', preparedStatus);

// Merge datasets
const stats = await mergeAllDatasets();
console.log('Dataset merged:', stats);

// Prepare for OpenAI fine-tuning
const openaiPath = await prepareForOpenAI();
console.log('OpenAI format path:', openaiPath);

// Prepare for Hugging Face
const huggingfacePath = await prepareForHuggingFace();
console.log('Hugging Face format path:', huggingfacePath);

// Or prepare all formats at once
const allFormats = await prepareAllFormats();
console.log('All prepared formats:', allFormats);
```

## Dataset Format

The merged dataset follows this normalized format:

```json
{
  "input": "User message or query",
  "response": "Assistant response",
  "rejected_response": "Alternative (rejected) response if available",
  "source": "Source dataset name",
  "type": "Type of interaction (e.g., counseling, instruction)",
  "tags": ["tag1", "tag2", "tag3"]
}
```

This consistent format makes it easier to use the data for various AI training purposes.

## Format-Specific Details

### OpenAI Format
The OpenAI format follows the chat completions JSONL format:

```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful mental health assistant."},
    {"role": "user", "content": "User input here"},
    {"role": "assistant", "content": "Assistant response here"}
  ]
}
```

### Hugging Face Format
The Hugging Face format is structured as:

```json
{
  "instruction": "Respond to the following message in a helpful, supportive manner:",
  "input": "User input here",
  "output": "Assistant response here",
  "source": "Source dataset",
  "tags": ["tag1", "tag2"]
}
```

## Troubleshooting

If you encounter any issues:

1. Check that all Python dependencies are installed correctly:
   ```bash
   pnpm merge-datasets:install
   ```

2. Ensure you have sufficient disk space for the datasets (approximately 2GB for all datasets)

3. If you encounter permission errors:
   - Check file permissions in the `datasets` directory
   - Avoid using `sudo` with pnpm commands
   - Check that the virtual environment is correctly activated

4. For API authentication issues:
   - Ensure proper authorization headers are included
   - Check server logs for detailed error messages

5. For Python errors:
   - Verify Python version is 3.8 or higher
   - Ensure pip is updated to the latest version

6. If you need to start fresh:
   - Delete the `datasets` directory and run the installation and merge processes again