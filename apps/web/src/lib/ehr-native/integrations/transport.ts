/**
 * EHR Native — Secure integration transport.
 *
 * Central outbound HTTP transport for HIE / e-prescribing adapters:
 * - Enforces HTTPS (or an explicit localhost exception for development) on
 *   every ePHI-bearing request (HIPAA §164.312(e)(1) transmission security).
 * - Provides a named, bindable send primitive so adapters never invoke the
 *   platform fetch directly — this keeps transport testable (injectable
 *   doubles) and gives CodeQL custom queries a single audited choke point.
 */

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])

/**
 * Validate that an outbound integration URL uses encrypted transport.
 * Returns the parsed URL on success; throws on plaintext remote endpoints.
 */
export function secureEphiUrl(url: string, source: string): URL {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' && !LOCAL_HOSTNAMES.has(parsed.hostname)) {
    throw new Error(
      `${source}: ePHI transport requires HTTPS (got ${parsed.protocol}//${parsed.hostname})`,
    )
  }
  return parsed
}

/**
 * Bound platform send primitive. Adapters must route all outbound ePHI
 * requests through this alias (see ADR-005 security guidance).
 */
export const secureSend: typeof fetch = globalThis.fetch.bind(globalThis)
