/**
 * Utility functions for robust JSON extraction from text strings
 * Used by MentalHealthTaskRouter and other components that need to parse JSON from LLM responses
 *
 * This module provides functions to safely extract and parse JSON content from potentially
 * malformed or mixed text, such as AI-generated responses that may contain JSON surrounded
 * by additional text or markdown formatting.
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('JsonExtraction')

/**
 * Extract JSON from a string using balanced brace matching
 * This approach is more robust than regex for handling nested objects and escaped characters
 *
 * Algorithm:
 * 1. Find the first opening brace '{'
 * 2. Use a stack-based approach to track nested braces
 * 3. Handle string literals with proper escape sequence parsing
 * 4. Return the complete JSON object when balanced braces are found
 *
 * @param text - The input text that may contain JSON (e.g., "Here's the result: {\"key\": \"value\"} Done.")
 * @returns The extracted JSON string (e.g., "{\"key\": \"value\"}") or null if no valid JSON is found
 *
 * @example
 * ```typescript
 * const result = extractJsonFromString('Analysis: {"category": "test", "score": 0.8} Complete');
 * // Returns: '{"category": "test", "score": 0.8}'
 *
 * const invalid = extractJsonFromString('No JSON here');
 * // Returns: null
 * ```
 */
export function extractJsonFromString(text: string): string | null {
  const trimmed = text.trim()

  // Find the first opening brace
  const startIndex = trimmed.indexOf('{')
  if (startIndex === -1) {
    return null
  }

  // Use a stack to find the matching closing brace
  let braceCount = 0
  let inString = false
  let escaped = false

  for (let i = startIndex; i < trimmed.length; i++) {
    const char = trimmed[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\' && inString) {
      escaped = true
      continue
    }

    if (char === '"' && !escaped) {
      inString = !inString
      continue
    }

    if (!inString) {
      if (char === '{') {
        braceCount++
      } else if (char === '}') {
        braceCount--
        if (braceCount === 0) {
          // Found the matching closing brace
          return trimmed.substring(startIndex, i + 1)
        }
      }
    }
  }

  // No matching closing brace found
  return null
}

/**
 * Parse and validate JSON with comprehensive error handling
 *
 * @param jsonString - The JSON string to parse (must be valid JSON format)
 * @returns The parsed JSON object with proper typing, or null if parsing fails
 *
 * @example
 * ```typescript
 * const result = safeJsonParse<{category: string}>('{"category": "test"}');
 * // Returns: { category: "test" }
 *
 * const invalid = safeJsonParse('invalid json');
 * // Returns: null (logs error)
 * ```
 */
export function safeJsonParse<T = unknown>(jsonString: string): T | null {
  try {
    return JSON.parse(jsonString) as unknown as T
  } catch (error: unknown) {
    logger.error('Failed to parse JSON string', {
      error: error instanceof Error ? String(error) : String(error),
      jsonPreview: jsonString.slice(0, 100),
    })
    return null
  }
}

/**
 * Extract and parse JSON from text in one operation
 * Combines extractJsonFromString and safeJsonParse for convenience
 *
 * @param text - The input text that may contain JSON
 * @returns The parsed JSON object with proper typing, or null if extraction or parsing fails
 *
 * @example
 * ```typescript
 * interface LLMResponse {
 *   category: string;
 *   confidence: number;
 * }
 *
 * const result = extractAndParseJson<LLMResponse>('LLM says: {"category": "test", "confidence": 0.9}');
 * // Returns: { category: "test", confidence: 0.9 }
 * ```
 */
export function extractAndParseJson<T = unknown>(text: string): T | null {
  const jsonString = extractJsonFromString(text)
  if (!jsonString) {
    return null
  }
  return safeJsonParse<T>(jsonString)
}
