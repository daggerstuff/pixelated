/**
 * Tests for Zod validation schemas.
 */

import { describe, it, expect } from 'vitest'
import {
  EmbeddingRequestSchema,
  BatchEmbeddingRequestSchema,
  SimilaritySearchRequestSchema,
  KnowledgeTypeSchema,
  EmbeddingModelSchema,
} from '../schemas'

describe('EmbeddingRequestSchema', () => {
  it('should validate valid request', () => {
    const result = EmbeddingRequestSchema.safeParse({
      text: 'Hello world',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.text).toBe('Hello world')
      expect(result.data.knowledgeType).toBe('general')
    }
  })

  it('should reject empty text', () => {
    const result = EmbeddingRequestSchema.safeParse({
      text: '',
    })

    expect(result.success).toBe(false)
  })

  it('should reject whitespace-only text', () => {
    const result = EmbeddingRequestSchema.safeParse({
      text: '   ',
    })

    expect(result.success).toBe(false)
  })

  it('should reject text exceeding max length', () => {
    const result = EmbeddingRequestSchema.safeParse({
      text: 'a'.repeat(10001),
    })

    expect(result.success).toBe(false)
  })

  it('should accept valid knowledge type', () => {
    const result = EmbeddingRequestSchema.safeParse({
      text: 'Test',
      knowledgeType: 'dsm5',
    })

    expect(result.success).toBe(true)
  })

  it('should reject invalid knowledge type', () => {
    const result = EmbeddingRequestSchema.safeParse({
      text: 'Test',
      knowledgeType: 'invalid_type',
    })

    expect(result.success).toBe(false)
  })

  it('should accept valid model', () => {
    const result = EmbeddingRequestSchema.safeParse({
      text: 'Test',
      model: 'all-MiniLM-L6-v2',
    })

    expect(result.success).toBe(true)
  })
})

describe('BatchEmbeddingRequestSchema', () => {
  it('should validate valid batch request', () => {
    const result = BatchEmbeddingRequestSchema.safeParse({
      texts: ['Hello', 'World'],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.texts).toHaveLength(2)
    }
  })

  it('should reject empty texts array', () => {
    const result = BatchEmbeddingRequestSchema.safeParse({
      texts: [],
    })

    expect(result.success).toBe(false)
  })

  it('should reject texts array exceeding max length', () => {
    const result = BatchEmbeddingRequestSchema.safeParse({
      texts: Array(101).fill('text'),
    })

    expect(result.success).toBe(false)
  })

  it('should reject empty strings in texts array', () => {
    const result = BatchEmbeddingRequestSchema.safeParse({
      texts: ['Valid', ''],
    })

    expect(result.success).toBe(false)
  })
})

describe('SimilaritySearchRequestSchema', () => {
  it('should validate valid search request', () => {
    const result = SimilaritySearchRequestSchema.safeParse({
      query: 'depression treatment',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.topK).toBe(10)
      expect(result.data.minSimilarity).toBe(0)
    }
  })

  it('should accept custom topK', () => {
    const result = SimilaritySearchRequestSchema.safeParse({
      query: 'test',
      topK: 50,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.topK).toBe(50)
    }
  })

  it('should reject topK exceeding max', () => {
    const result = SimilaritySearchRequestSchema.safeParse({
      query: 'test',
      topK: 101,
    })

    expect(result.success).toBe(false)
  })

  it('should accept knowledge type filters', () => {
    const result = SimilaritySearchRequestSchema.safeParse({
      query: 'test',
      knowledgeTypes: ['dsm5', 'clinical'],
    })

    expect(result.success).toBe(true)
  })

  it('should accept min similarity in valid range', () => {
    const result = SimilaritySearchRequestSchema.safeParse({
      query: 'test',
      minSimilarity: 0.5,
    })

    expect(result.success).toBe(true)
  })

  it('should reject min similarity out of range', () => {
    const result = SimilaritySearchRequestSchema.safeParse({
      query: 'test',
      minSimilarity: 1.5,
    })

    expect(result.success).toBe(false)
  })
})

describe('KnowledgeTypeSchema', () => {
  it('should accept all valid knowledge types', () => {
    const validTypes = [
      'dsm5',
      'pdm2',
      'clinical',
      'therapeutic_technique',
      'therapeutic_conversation',
      'general',
    ]

    for (const type of validTypes) {
      const result = KnowledgeTypeSchema.safeParse(type)
      expect(result.success).toBe(true)
    }
  })

  it('should reject invalid knowledge type', () => {
    const result = KnowledgeTypeSchema.safeParse('invalid')
    expect(result.success).toBe(false)
  })
})

describe('EmbeddingModelSchema', () => {
  it('should accept all valid models', () => {
    const validModels = [
      'all-MiniLM-L6-v2',
      'all-MiniLM-L12-v2',
      'all-mpnet-base-v2',
      'BAAI/bge-small-en-v1.5',
      'BAAI/bge-base-en-v1.5',
      'emilyalsentzer/Bio_ClinicalBERT',
    ]

    for (const model of validModels) {
      const result = EmbeddingModelSchema.safeParse(model)
      expect(result.success).toBe(true)
    }
  })

  it('should reject invalid model', () => {
    const result = EmbeddingModelSchema.safeParse('invalid-model')
    expect(result.success).toBe(false)
  })
})

