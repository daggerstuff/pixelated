/**
 * EHR Native — External Integrations (Phase 2-3)
 *
 * Integration adapters for external healthcare services:
 * - Clearinghouse (Change Healthcare) — eligibility, claims tracking
 * - E-prescribing (DoseSpot / DrFirst) — Phase 3
 * - HIE (Carequality / DirectTrust) — Phase 3
 * - Telehealth (WebRTC-first, Zoom fallback)
 *
 * All integrations are vendor-managed, not custom-built.
 *
 * @see docs/adr/ADR-003-clearinghouse-billing.md
 * @see docs/adr/ADR-004-eprescribing-vendor.md
 */

export * from './hie'
