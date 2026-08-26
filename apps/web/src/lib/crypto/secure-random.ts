import { randomBytes, randomInt, randomUUID } from 'crypto'

/**
 * Return a cryptographically secure random hex string.
 * bytes: number of random bytes (default 32 -> 64 hex chars)
 */
export function secureRandomHex(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

/**
 * Return a cryptographically secure random integer in [0, maxExclusive)
 * Uses crypto.randomInt which is safe for cryptographic purposes.
 */
export function secureRandomInt(maxExclusive: number): number {
  return randomInt(0, Math.max(1, Math.floor(maxExclusive)))
}

/**
 * Return a crypto-safe UUID (v4)
 */
export function secureRandomUUID(): string {
  return randomUUID()
}
