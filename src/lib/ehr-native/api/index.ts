/**
 * EHR Native — API Surface (F1.6)
 *
 * REST API for EHR resources. Mounted at /api/ehr/v1/.
 *
 * Endpoints:
 * - /patients — patient chart CRUD
 * - /encounters — encounter management
 * - /appointments — scheduling
 * - /notes — clinical notes (DocumentReference)
 * - /claims — claims tracking via clearinghouse
 * - /consents — consent management
 * - /observations — outcome measures (PHQ-9, GAD-7, etc.)
 *
 * OpenAPI 3.1 spec generated via codegen.ts; linted by .spectral.yaml.
 * RBAC enforced on every endpoint (see ADR-005).
 *
 * @see docs/adr/ADR-005-ehr-rbac.md
 */

export {}
