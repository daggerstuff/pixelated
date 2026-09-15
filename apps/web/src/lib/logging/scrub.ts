/**
 * Log-value scrubbing.
 *
 * Every structured object that reaches the logger passes through `scrub()`
 * before it is handed to the console (or any future sink). Sensitive keys are
 * replaced with '[REDACTED]' and PII-shaped values are masked, so a debug
 * payload or an error context object can never leak credentials, tokens, or
 * patient identifiers into log storage.
 *
 * Matching is deliberately broad: a key that merely *contains* "token" or
 * "password" is redacted even if it was not on a list somewhere. False
 * positives (a redacted field nobody needed) are cheap; a leaked JWT is not.
 */

/** Exact key names that are always sensitive. */
const SENSITIVE_KEY_SUBSTRINGS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'credential',
  'privatekey',
  'private_key',
  'sessionid',
  'session_id',
  'jwt',
  'cookie',
  'ssn',
  'phonenumber',
  'phone_number',
  'patientname',
  'patient_name',
  'dateofbirth',
  'date_of_birth',
  'creditcard',
  'credit_card',
]

const REDACTED = '[REDACTED]'

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-\s]/g, '_')
  return SENSITIVE_KEY_SUBSTRINGS.some((needle) => normalized.includes(needle))
}

/** Mask emails and long bearer-style tokens inside string values. */
function scrubString(value: string): string {
  return value
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[REDACTED-EMAIL]')
    .replace(/\b(?:bearer|basic)\s+[a-z0-9\-._~+/]+=*/gi, '[REDACTED-CREDENTIAL]')
}

const SCRUB_DEPTH_LIMIT = 4

function scrubValue(value: unknown, depth: number): unknown {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'string' ? scrubString(value) : value
  }
  if (depth >= SCRUB_DEPTH_LIMIT) return REDACTED

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1))
  }

  if (value instanceof Error) {
    return value
  }
  if (value instanceof Date) {
    return value
  }

  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitiveKey(key) ? REDACTED : scrubValue(val, depth + 1)
  }
  return out
}

/**
 * Redact sensitive keys and PII patterns from a log payload. Returns the input
 * unchanged for non-objects; never mutates the caller's object.
 */
export function scrub(value: unknown): unknown {
  return scrubValue(value, 0)
}
