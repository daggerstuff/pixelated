/**
 * Unit tests for JSON extraction utility functions
 */

import {
  extractJsonFromString,
  safeJsonParse,
  extractAndParseJson,
} from '../json-extraction'

describe('extractJsonFromString', () => {
  it('should extract simple JSON object', () => {
    const input = '{"category": "test", "value": 123}'
    const result = extractJsonFromString(input)
    expect(result).toBe('{"category": "test", "value": 123}')
  })

  it('should extract JSON from mixed text', () => {
    const input =
      'Here is the result: {"category": "anxiety", "confidence": 0.8} Done.'
    const result = extractJsonFromString(input)
    expect(result).toBe('{"category": "anxiety", "confidence": 0.8}')
  })

  it('should handle nested JSON objects', () => {
    const input =
      'Analysis: {"data": {"nested": true, "count": 5}, "meta": "info"}'
    const result = extractJsonFromString(input)
    expect(result).toBe(
      '{"data": {"nested": true, "count": 5}, "meta": "info"}',
    )
  })

  it('should handle escaped quotes in strings', () => {
    const input = '{"message": "He said \\"Hello world\\"", "valid": true}'
    const result = extractJsonFromString(input)
    expect(result).toBe(
      '{"message": "He said \\"Hello world\\"", "valid": true}',
    )
  })

  it('should return null for text without JSON', () => {
    const input = 'This is just plain text with no JSON'
    const result = extractJsonFromString(input)
    expect(result).toBeNull()
  })

  it('should return null for malformed JSON (unbalanced braces)', () => {
    const input = '{"incomplete": "object"'
    const result = extractJsonFromString(input)
    expect(result).toBeNull()
  })

  it('should handle empty string', () => {
    const result = extractJsonFromString('')
    expect(result).toBeNull()
  })

  it('should extract first JSON object when multiple exist', () => {
    const input = '{"first": 1} and then {"second": 2}'
    const result = extractJsonFromString(input)
    expect(result).toBe('{"first": 1}')
  })
})

describe('safeJsonParse', () => {
  it('should parse valid JSON string', () => {
    const input = '{"category": "test", "value": 123}'
    const result = safeJsonParse(input)
    expect(result).toEqual({ category: 'test', value: 123 })
  })

  it('should return null for invalid JSON', () => {
    const input = '{invalid json}'
    const result = safeJsonParse(input)
    expect(result).toBeNull()
  })

  it('should handle empty string', () => {
    const result = safeJsonParse('')
    expect(result).toBeNull()
  })

  it('should work with typed interfaces', () => {
    interface TestType {
      name: string
      count: number
    }

    const input = '{"name": "test", "count": 42}'
    const result = safeJsonParse<TestType>(input)
    expect(result).toEqual({ name: 'test', count: 42 })
  })
})

describe('extractAndParseJson', () => {
  it('should extract and parse JSON in one operation', () => {
    const input =
      'LLM response: {"category": "depression", "confidence": 0.85} End'
    const result = extractAndParseJson(input)
    expect(result).toEqual({ category: 'depression', confidence: 0.85 })
  })

  it('should return null when no JSON found', () => {
    const input = 'No JSON content here'
    const result = extractAndParseJson(input)
    expect(result).toBeNull()
  })

  it('should return null when JSON is malformed', () => {
    const input = 'Contains: {malformed json} here'
    const result = extractAndParseJson(input)
    expect(result).toBeNull()
  })

  it('should work with typed interfaces', () => {
    interface LLMResponse {
      category: string
      confidence: number
      reasoning: string
    }

    const input =
      'Result: {"category": "anxiety", "confidence": 0.9, "reasoning": "signs of worry"}'
    const result = extractAndParseJson<LLMResponse>(input)
    expect(result).toEqual({
      category: 'anxiety',
      confidence: 0.9,
      reasoning: 'signs of worry',
    })
  })

  it('should handle complex nested structures', () => {
    const input =
      'Analysis: {"metadata": {"timestamp": "2023-01-01", "version": 2}, "results": [{"id": 1, "score": 0.95}]}'
    const result = extractAndParseJson(input)
    expect(result).toEqual({
      metadata: { timestamp: '2023-01-01', version: 2 },
      results: [{ id: 1, score: 0.95 }],
    })
  })
})
