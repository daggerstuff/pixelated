/**
 * Comprehensive Anonymization Pipeline
 * Orchestrates PHI/PII detection and redaction for both text and object data.
 * Provides audit logging and secure, testable interface for anonymization.
 *
 * Security: Follows HIPAA, OWASP, and project-specific privacy requirements.
 * Usage: Import and call anonymizeData(input, options) for all data flows requiring anonymization.
 */

import { piiDetectionService } from './pii'
import { phiDetector, detectAndRedactPHIAsync } from './phiDetection'
import { createPrivacyHash } from '../../simulator/utils/privacy'
import * as crypto from 'crypto'

// Types
export interface AnonymizationResult<T = Record<string, unknown> | string> {
  anonymized: T
  summary: {
    redactedFields: string[]
    redactedTextEntities?: Array<{ type: string; start: number; end: number }>
    auditId: string
    timestamp: number
    inputType: 'text' | 'object'
    errors?: string[]
  }
}

export interface AnonymizationOptions {
  redact?: boolean // default: true
  types?: string[] // PII/PHI types to detect
  sensitiveKeys?: string[]
  auditContext?: Record<string, unknown>
}

function isRecord(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj)
}

/**
 * Main anonymization function
 * @param input - Text or object to anonymize
 * @param options - Anonymization options
 */
export async function anonymizeData<T extends Record<string, unknown> | string>(
  input: T,
  options: AnonymizationOptions = {},
): Promise<AnonymizationResult<T>> {
  const timestamp = Date.now()
  // Use cryptographically secure random bytes instead of Math.random for audit id
  const secureSuffix = crypto.randomBytes(8).toString('hex')
  const auditId = createPrivacyHash(`${timestamp}_${secureSuffix}`)
  let summary: AnonymizationResult['summary'] = {
    redactedFields: [],
    auditId,
    timestamp,
    inputType: typeof input === 'string' ? 'text' : 'object',
  }

  try {
    if (typeof input === 'string') {
      // TEXT anonymization (PHI)
      // Use the phiDetector utility exported from ./phiDetection.ts which provides
      // async detection/redaction helpers and a singleton detector instance.
      // Prefer the async helper which returns redacted text. If we need entities,
      // call the detector directly.
      const redactedText = await detectAndRedactPHIAsync(input)

      // Attempt to get entities from the detector (best-effort, may be empty)
      try {
        const detection = await phiDetector.detectPHI(input)
        if (detection && Array.isArray(detection.entities)) {
          summary.redactedTextEntities = detection.entities.map((e) => ({
            type: String(e.type),
            start: e.start,
            end: e.end,
          }))
        }
      } catch (detErr) {
        // Non-fatal: record detection error in summary but still return redacted text
        summary.errors = [
          detErr instanceof Error ? detErr.message : String(detErr),
        ]
      }

      return {
        anonymized: redactedText as unknown as T,
        summary,
      }
    } else if (typeof input === 'object' && input !== null) {
      // OBJECT anonymization (PII)
      if (isRecord(input)) {
        const { processed, hasPII } = await piiDetectionService.processObject(
          input,
          {
            ...options,
            types: options.types as import('./pii').PIIType[] | undefined,
          },
        )
        summary.redactedFields = hasPII
          ? Object.keys(processed).filter((k) => processed[k] === '[REDACTED]')
          : []
        return {
          anonymized: processed as T,
          summary,
        }
      } else {
        summary.errors = [
          'Input object is not a Record<string, unknown> and cannot be anonymized.',
        ]
        return {
          anonymized: {} as T,
          summary,
        }
      }
    } else {
      throw new Error('Unsupported input type for anonymization')
    }
  } catch (error: unknown) {
    summary.errors = [error instanceof Error ? String(error) : String(error)]
    // Log anonymization failure (do not log sensitive input)
    if (typeof window !== 'undefined') {
      // Browser context
      console.error('Anonymization pipeline error', {
        auditId,
        error: summary.errors[0],
      })
    } else {
      // Node/server context
      // eslint-disable-next-line no-console
      console.error('Anonymization pipeline error', {
        auditId,
        error: summary.errors[0],
      })
    }
    return {
      anonymized: (typeof input === 'string' ? '' : {}) as T,
      summary,
    }
  }
}

/**
 * Example usage:
 * const result = await anonymizeData(userInput, { types: ['NAME', 'EMAIL'] });
 * if (result.summary.errors) { ...handle error... }
 * else { ...use result.anonymized... }
 */

// TODO: Integrate this pipeline in all sensitive data flows (API, analytics, exports, etc.)
