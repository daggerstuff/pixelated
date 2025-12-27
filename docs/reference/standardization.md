# Canonical Format Mapping for Downstream Models

## Overview

The standardization pipeline transforms raw conversation data into a canonical format optimized for downstream AI models, particularly for supervised fine-tuning (SFT) of therapeutic AI systems like Wayfarer-2-12B. The canonical format uses ChatML for conversation structure, with normalized tokenization and metadata preservation for traceability and quality control.

## Canonical Format Specification

### Core Structure
- **Format**: ChatML (Message List Format)
- **Primary Key**: `messages` - List of message objects
  - Each message: `{"role": "user|assistant|system", "content": "text"}`
- **Metadata Fields**:
  - `id`: Deterministic stable identifier (UUIDv5 based on hash of normalized content + metadata)
  - `source`: Original dataset/source identifier
  - `timestamp`: Processing timestamp (ISO 8601)
  - `quality_score`: Aggregated quality score (0.0-1.0)
  - `tags`: List of tags (e.g., ["depression", "crisis", "empathy_training"])
  - `mental_health_condition`: Inferred primary condition (e.g., "anxiety", "depression")
- **Normalization Rules**:
  - Text: Lowercase, strip extra whitespace, remove HTML entities
  - Tokenization: ChatML tokenizer with max_length=2048, truncation enabled
  - Deduplication: TF-IDF clustering + LSH for similarity > 0.85
  - Encoding: UTF-8, no special characters beyond ChatML delimiters

### Tokenization Mapping
- **Tokenizer**: AutoTokenizer from HuggingFace (Wayfarer-2-12B compatible)
  - Model: `meta-llama/Llama-2-7b-chat-hf` or equivalent
  - Special Tokens: `<|im_start|>user<|im_end|>\n`, `<|im_start|>assistant<|im_end|>\n`
- **Input**: Raw text from various sources (JSONL, CSV, Parquet) converted to ChatML string
  - Example: `<|user|>\nHello, I'm feeling anxious.\n<|assistant|>\nI understand how anxiety can be overwhelming. Let's explore coping strategies.\n`
- **Output**: 
  - `input_ids`: Tokenized sequence (list of integers)
  - `attention_mask`: Mask for padding/truncation
  - Preserved length: Max 2048 tokens, padded to max_length with right truncation

## Downstream Model Integration

### Supervised Fine-Tuning (SFT)
- **Model Target**: Wayfarer-2-12B (Llama-2-7B base with therapeutic fine-tuning)
- **Training Format**: HuggingFace Dataset with `input_ids`, `attention_mask`, `labels` (shifted input_ids for causal LM)
- **Mapping Process**:
  1. Canonical ChatML → Tokenized input_ids via ChatML tokenizer
  2. Labels: Shift input_ids right by 1, mask non-response tokens
  3. Batch collation: Dynamic padding based on max_length
- **Batch Size**: 8-16 (GPU memory dependent)
- **Loss Computation**: Causal language modeling loss on assistant responses only (ignore user tokens)

### Bias Detection Models
- **Model**: Custom TF-IDF + BERT-based bias classifier
- **Input**: Normalized conversation text (pre-tokenized)
  - Features: TF-IDF vectors (256 dims) + BERT embeddings (768 dims)
  - Labels: Binary (biased/non-biased) + severity score
- **Integration**: Post-tokenization hook in standardization pipeline
  - Threshold: Bias score > 0.7 → Quarantine for review
  - Metrics: Precision/recall tracked per condition/topic

### Embedding Models for RAG
- **Model**: Sentence-BERT (all-MiniLM-L6-v2) for conversation embeddings
- **Input**: Canonical ChatML string (max 512 tokens)
- **Output**: 384-dimensional embeddings stored in vector DB (Qdrant/Pinecone)
- **Indexing**: HNSW index with M=16, ef_construction=200
- **Query Mapping**: User queries tokenized similarly, cosine similarity search
- **Retrieval**: Top-K (k=5) + reranking by therapeutic relevance

### Quality Validation Integration
- **Pre-Training Validation**: Canonical format validated against schema (Pydantic + custom rules)
  - Schema: JSON Schema for ChatML + metadata constraints
  - Checks: Token length, role balance, content coherence, ethical guidelines
- **Post-Training Evaluation**: 
  - Perplexity: Computed on held-out validation set
  - ROUGE/BLEU: Response quality against reference therapeutic responses
  - Bias Metrics: Disparity in scores across demographic groups

## Performance Considerations
- **Tokenization Efficiency**: Batch processing with padding, average 150ms/batch (16 convs)
- **Memory Usage**: ~2GB for 100k conversation dataset (tokenized)
- **Scalability**: Distributed tokenization via Ray/Dask for >1M records
- **Validation Speed**: ~50ms/conversation for full schema + quality checks

## Error Handling & Edge Cases
- **Invalid ChatML**: Fallback to text normalization + warning log
- **Token Overflow**: Truncate to max_length, preserve assistant response
- **Encoding Issues**: UTF-8 validation + fallback to ASCII transliteration
- **Deduplication Conflicts**: Stable ID resolution via content hash priority

## Versioning & Backward Compatibility
- **Schema Version**: 1.0 (ChatML 1.0 + metadata v1)
- **Migration Path**: Automated converter for legacy formats (JSONL, CSV)
- **Deprecation Policy**: 2 major versions supported, notify on load

For detailed implementation, see `ai/dataset_pipeline/chatml_tokenizer.py`, `ai/dataset_pipeline/format_converter.py`, and `ai/dataset_pipeline/enterprise_deduplication.py`.