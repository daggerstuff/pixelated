/**
 * Comprehensive Anonymization Pipeline
 * Orchestrates PHI/PII detection and redaction for both text and object data.
 * Provides audit logging and secure, testable interface for anonymization.
 *
 * Security: Follows HIPAA, OWASP, and project-specific privacy requirements.
 * Usage: Import and call anonymizeData(input, options) for all data flows requiring anonymization.
 */

import { piiDetectionService } from './pii'
import { Anonymizer as PHIAnonymizer } from './phiDetection'
import { createPrivacyHash } from '../../simulator/utils/privacy'

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
  const auditId = createPrivacyHash(`${timestamp}_${Math.random()}`)
  let summary: AnonymizationResult['summary'] = {
    redactedFields: [],
    auditId,
    timestamp,
    inputType: typeof input === 'string' ? 'text' : 'object',
  }

  try {
    if (typeof input === 'string') {
      // TEXT anonymization (PHI)
      const phiAnonymizer = new PHIAnonymizer()
      // PHI entities would be detected here; fallback to redacting all detected entities
      // TODO: Replace with real PHI detection integration
      const redacted = await phiAnonymizer.anonymize({ text: input })
      if ('entities' in redacted) {
        summary.redactedTextEntities = redacted.entities as Array<{
          type: string
          start: number
          end: number
        }>
      }
      return {
        anonymized: redacted.text,
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
      anonymized: typeof input === 'string' ? '' : ({} as T),
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
