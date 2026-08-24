/**
 * EHR Native — External Integrations (Phase 2-3)
 *
 * Integration adapters for external healthcare services:
 * - Clearinghouse — eligibility verification, claim submission, status tracking, remittance
 * - E-prescribing (DoseSpot / DrFirst) — Phase 3
 * - HIE (Carequality / DirectTrust) — Phase 3
 * - Telehealth (WebRTC-first, Zoom fallback)
 *
 * Each integration follows the adapter pattern: an interface defines the
 * contract, a stub implementation supports development/testing, and a real
 * implementation can be swapped in without changing consuming code.
 *
 * @see docs/adr/ADR-003-clearinghouse-billing.md — to be created
 * @see docs/adr/ADR-004-eprescribing-vendor.md — to be created
 */

export * from './clearinghouse'
