/**
 * EHR Native — External Integrations (Phase 2-3)
 *
 * Integration adapters for external healthcare services:
 * - Clearinghouse (Change Healthcare) — eligibility, claims tracking
 * - E-prescribing (Surescripts) — pharmacy lookup, controlled substance, transmission
 * - HIE (Carequality / DirectTrust) — Phase 3
 * - Telehealth (WebRTC-first, Zoom fallback)
 *
 * @see docs/adr/ADR-003-clearinghouse-billing.md
 * @see docs/adr/ADR-004-eprescribing-vendor.md
 */

export * from './hie'
export * from './types'
export * from './calendly'
export * from './zoom'
export * from './stripe'
export * from './twilio'
export * from './marketplace'
export * from './webhooks'
export type { PaginatedResponse } from './calendly'
