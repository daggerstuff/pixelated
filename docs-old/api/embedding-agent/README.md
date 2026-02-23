# Embedding Agent API

Vector embedding service for clinical knowledge and therapeutic content.

## Overview

The Embedding Agent API provides text-to-vector conversion and similarity search capabilities optimized for clinical and psychological knowledge. It supports multiple embedding models and provides efficient caching for repeated queries.

## Features

- **Single Text Embedding**: Convert text to vector representation
- **Batch Embedding**: Process multiple texts efficiently
- **Similarity Search**: Find similar content in the knowledge base
- **Multiple Models**: Support for various embedding models
- **Caching**: Automatic caching of embeddings for performance
- **Clinical Optimization**: Models optimized for clinical/therapeutic content

## Quick Start

### Base URL

```
# Python Service (direct)
http://localhost:8001

# Astro API Gateway
https://api.pixelatedempathy.com/api/ai/embeddings
```

### Authentication

All endpoints require JWT authentication:

```bash
curl -H "Authorization: Bearer <your-jwt-token>" \
     -H "Content-Type: application/json" \
     https://api.pixelatedempathy.com/api/ai/embeddings/embed
```

## Endpoints

### POST /api/ai/embeddings/embed

Generate embedding for a single text.

**Request Body:**

```json
{
  "text": "Major Depressive Disorder symptoms include persistent sadness...",
  "knowledgeType": "dsm5",
  "metadata": {
    "source": "clinical_notes"
  },
  "model": "all-MiniLM-L6-v2"
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | ✓ | Text to embed (1-10000 chars) |
| `knowledgeType` | enum | | Type categorization (see below) |
| `metadata` | object | | Custom metadata |
| `model` | enum | | Embedding model to use |

**Response:**

```json
{
  "embedding": [0.123, -0.456, ...],
  "embeddingId": "emb_abc123def456",
  "modelUsed": "all-MiniLM-L6-v2",
  "dimension": 384,
  "textHash": "a1b2c3d4",
  "cached": false,
  "processingTimeMs": 45.2,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### POST /api/ai/embeddings/batch

Generate embeddings for multiple texts.

**Request Body:**

```json
{
  "texts": [
    "First text for embedding",
    "Second text for embedding",
    "Third text for embedding"
  ],
  "knowledgeTypes": ["dsm5", "clinical", "general"],
  "model": "all-MiniLM-L6-v2"
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `texts` | string[] | ✓ | Array of texts (1-100 items) |
| `knowledgeTypes` | enum[] | | Types for each text |
| `metadataList` | object[] | | Metadata for each text |
| `model` | enum | | Embedding model |

**Response:**

```json
{
  "embeddings": [
    {
      "index": 0,
      "embedding": [0.123, ...],
      "embeddingId": "emb_1",
      "textHash": "hash1",
      "cached": false
    },
    ...
  ],
  "totalCount": 3,
  "cachedCount": 1,
  "generatedCount": 2,
  "modelUsed": "all-MiniLM-L6-v2",
  "dimension": 384,
  "processingTimeMs": 125.5,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### POST /api/ai/embeddings/search

Search for similar content in the knowledge base.

**Request Body:**

```json
{
  "query": "treatment options for anxiety disorders",
  "topK": 10,
  "knowledgeTypes": ["dsm5", "clinical"],
  "minSimilarity": 0.5,
  "includeMetadata": true
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✓ | Search query |
| `queryEmbedding` | number[] | | Pre-computed embedding |
| `topK` | integer | | Results to return (1-100) |
| `knowledgeTypes` | enum[] | | Filter by types |
| `minSimilarity` | number | | Threshold (0-1) |
| `includeMetadata` | boolean | | Include metadata |

**Response:**

```json
{
  "matches": [
    {
      "itemId": "dsm5_anxiety_001",
      "content": "Generalized Anxiety Disorder...",
      "similarityScore": 0.92,
      "knowledgeType": "dsm5",
      "source": "DSM-5",
      "metadata": { ... }
    },
    ...
  ],
  "queryEmbeddingId": "emb_query_123",
  "totalSearched": 1500,
  "processingTimeMs": 28.3,
  "modelUsed": "all-MiniLM-L6-v2"
}
```

### GET /api/ai/embeddings/status

Get detailed service status.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `health` | boolean | Return simple health check |

**Response (detailed):**

```json
{
  "status": "healthy",
  "modelLoaded": true,
  "modelName": "all-MiniLM-L6-v2",
  "embeddingDimension": 384,
  "cacheSize": 1500,
  "knowledgeItemsCount": 5000,
  "gpuAvailable": false,
  "uptimeSeconds": 86400,
  "requestsProcessed": 10000,
  "averageResponseTimeMs": 42.5,
  "lastRequestAt": "2024-01-15T10:30:00Z"
}
```

**Response (health check):**

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "modelLoaded": true,
  "cacheAvailable": true,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### POST /api/ai/embeddings/status

Administrative actions (requires admin role).

**Request Body:**

```json
{
  "action": "clear_cache"
}
```

**Actions:**
- `clear_cache`: Clear the embedding cache
- `load_knowledge`: Load/reload knowledge base

### DELETE /api/ai/embeddings/cache

Clear the embedding cache.

**Response:**

```json
{
  "success": true,
  "itemsCleared": 1500,
  "message": "Cleared 1500 cached embeddings"
}
```

### GET /api/ai/embeddings/cache/stats

Get cache statistics.

**Response:**

```json
{
  "cacheSize": 1500,
  "cacheEnabled": true
}
```

### GET /api/ai/embeddings/config

Get current configuration.

**Response:**

```json
{
  "modelName": "all-MiniLM-L6-v2",
  "embeddingDimension": 384,
  "batchSize": 32,
  "maxTextLength": 512,
  "normalizeEmbeddings": true,
  "cacheEmbeddings": true,
  "useGpu": false
}
```

### GET /api/ai/embeddings/models

List available embedding models.

**Response:**

```json
{
  "models": [
    {
      "id": "all-MiniLM-L6-v2",
      "name": "MINILM_L6_V2",
      "dimension": 384,
      "description": "Fast, lightweight model with good quality (384 dim)"
    },
    {
      "id": "all-mpnet-base-v2",
      "name": "MPNET_BASE_V2",
      "dimension": 768,
      "description": "Higher quality, larger model (768 dim)"
    },
    ...
  ]
}
```

## Knowledge Types

| Type | Description |
|------|-------------|
| `dsm5` | DSM-5 diagnostic criteria |
| `pdm2` | PDM-2 psychodynamic manual |
| `clinical` | Clinical guidelines and protocols |
| `therapeutic_technique` | Therapeutic techniques and interventions |
| `therapeutic_conversation` | Example therapeutic dialogues |
| `general` | General psychological knowledge |

## Embedding Models

| Model ID | Dimension | Speed | Quality | Use Case |
|----------|-----------|-------|---------|----------|
| `all-MiniLM-L6-v2` | 384 | ⚡⚡⚡ | ★★★ | Default, balanced |
| `all-MiniLM-L12-v2` | 384 | ⚡⚡ | ★★★★ | Better quality |
| `all-mpnet-base-v2` | 768 | ⚡ | ★★★★★ | Highest quality |
| `BAAI/bge-small-en-v1.5` | 384 | ⚡⚡⚡ | ★★★★ | Latest efficient |
| `BAAI/bge-base-en-v1.5` | 768 | ⚡⚡ | ★★★★★ | Latest quality |
| `emilyalsentzer/Bio_ClinicalBERT` | 768 | ⚡ | ★★★★ | Clinical domain |

## Error Handling

### Error Response Format

```json
{
  "error": "validation_error",
  "message": "Text cannot be empty",
  "details": {
    "field": "text",
    "code": "min_length"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_abc123"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing/invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 422 | Validation Error - Schema validation failed |
| 429 | Rate Limited |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

## Rate Limits

| Role | Limit |
|------|-------|
| Anonymous | 10 requests/minute |
| Authenticated | 100 requests/minute |
| Admin | 1000 requests/minute |

## TypeScript SDK

```typescript
import {
  createEmbeddingAgentClient,
  EmbeddingRequestSchema,
  type EmbeddingRequest,
  type EmbeddingResponse,
} from '@/lib/ai/embedding-agent'

// Create client
const client = createEmbeddingAgentClient('http://localhost:8001')

// Single embedding
const response = await client.embedText({
  text: 'Depression symptoms',
  knowledgeType: 'dsm5',
})
console.log(response.embedding) // [0.123, -0.456, ...]

// Batch embedding
const batchResponse = await client.embedBatch({
  texts: ['First text', 'Second text'],
})

// Similarity search
const searchResponse = await client.searchSimilar({
  query: 'anxiety treatment',
  topK: 5,
})

// Validation
const validationResult = EmbeddingRequestSchema.safeParse(userInput)
if (validationResult.success) {
  await client.embedText(validationResult.data)
}
```

## Python Service

### Starting the Service

```bash
cd ai/api/embedding_agent
uv run uvicorn app:app --host 0.0.0.0 --port 8001
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Default model |
| `EMBEDDING_BATCH_SIZE` | `32` | Batch processing size |
| `EMBEDDING_MAX_LENGTH` | `512` | Max text length |
| `EMBEDDING_CACHE` | `true` | Enable caching |
| `EMBEDDING_USE_GPU` | `false` | Enable GPU |
| `EMBEDDING_AGENT_PORT` | `8001` | Service port |
| `EMBEDDING_AGENT_HOST` | `0.0.0.0` | Service host |
| `EMBEDDING_LOAD_KNOWLEDGE` | `false` | Load knowledge on startup |

### Docker

```bash
docker build -t embedding-agent -f ai/api/embedding_agent/Dockerfile .
docker run -p 8001:8001 embedding-agent
```

## Performance

### Response Times

| Operation | Typical | Target |
|-----------|---------|--------|
| Single embed | <100ms | <50ms |
| Batch embed (10) | <500ms | <200ms |
| Similarity search | <50ms | <30ms |
| Health check | <10ms | <5ms |

### Caching Strategy

- L1: In-memory hash-based cache
- Cache key: `{model}:{text_hash}`
- Hit rate typically >60% for repeated queries

## Related Documentation

- [AI API Reference](../README.md)
- [Clinical Knowledge Embedder](../../implementation/mistral-rag.md)
- [Mental Health Analysis API](../mental-health/)

