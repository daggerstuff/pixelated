# API Specification — Vendor Share Package

**Issue:** PIX-4136 (S2 task: "Share API documentation (OpenAPI/Swagger specs)")
**Last updated:** 2026-07-29 **Companion to:**
`docs/linear-audit/threat-model-scope.md`

---

## 1. Purpose

Document which OpenAPI / Swagger specifications will be shared with the selected
penetration testing vendor, the sanitization steps applied, and the tracking
procedure for the share. Vendor uses these specs to:

1. Discover the public API surface
2. Generate request sequences for auth / cross-tenant tests
3. Verify scope coverage (read vs write vs admin) matches the threat model

---

## 2. Specifications to Share

| File                                | Size  | Scope                                        | Purpose                                                                     |
| ----------------------------------- | ----- | -------------------------------------------- | --------------------------------------------------------------------------- |
| `docs/api-reference/openapi.yaml`   | 65 KB | **Public API** (all client-facing endpoints) | Vendor's primary fuzz / scope-craft input                                   |
| `docs/api-reference/openapi.json`   | 11 KB | Same as above, JSON form                     | Some vendors prefer JSON                                                    |
| `ai/docs/api/openapi.yaml`          | 12 KB | AI-service internal endpoints                | Out-of-scope for external pentest unless S3-S9 change order adds AI service |
| `ai/docs/api/openapi-enhanced.yaml` | 26 KB | AI-service extended schema (private routes)  | **Internal only — DO NOT share** without explicit approval                  |

---

## 3. Pre-Share Sanitization Checklist

Before transmitting specs to the vendor, apply these checks. **Confirm each item
is true; do not skip.**

- [ ] All internal-only endpoints (path prefix `/internal/`, `/admin/internal/`)
      removed or marked `x-internal: true`
- [ ] Internal hostnames / IPs replaced with vendor-facing placeholder
      (`api.pixelated-empathy.com` or staging URL)
- [ ] Auth0 tenant region / domain redacted to neutral placeholder
- [ ] Any `example` values containing real user IDs, real tenantIds, real API
      keys scrubbed — replace with `PLACEHOLDER_*`
- [ ] Response `example` objects with PHI removed; replaced with empty object
- [ ] Internal CI / staging URLs removed from `servers` block
- [ ] Webhook signing secrets referenced in examples replaced with
      `REDACTED_WEBHOOK_SECRET`
- [ ] Internal-only error codes (e.g., debug codes 9000-9999) collapsed or
      removed

**Owner:** Chad. **Reviewer:** one additional engineer. **Both must sign off in
the Linear issue comment.**

---

## 4. Tracking the Share

| Date      | Vendor    | Spec Version | SHA-256 (spec file) | Recipient | Acknowledgment |
| --------- | --------- | ------------ | ------------------- | --------- | -------------- |
| _pending_ | _pending_ | _pending_    | _pending_           | _pending_ | _pending_      |

Use `shasum -a 256 docs/api-reference/openapi.yaml` to capture the digest before
sending. Vendor must acknowledge receipt in writing (email is fine).

---

## 5. Vendor Use Constraints

Vendor must:

1. Use the spec **only** for the contracted pentest engagement.
2. Not retain copies beyond the engagement closing date + 30 days.
3. Not publish any endpoint paths or parameters discovered via spec review
   without Pixelated's written permission.
4. Report any endpoint found in the spec that contradicts the threat model
   (e.g., an internal endpoint they believe is publicly accessible).

These constraints go into the MSA / NDA signed during PIX-4135 vendor selection.

---

## 6. Threat-Model Cross-Reference

See `threat-model-scope.md` §9 (Prioritized Pentest Focus Areas). The following
spec sections are most relevant for each focus area:

| Focus Area                                  | Spec Section                                          |
| ------------------------------------------- | ----------------------------------------------------- |
| #1 Cross-tenant data leakage                | All endpoints with `tenantId` query param or path     |
| #2 API scope escalation                     | All endpoints with `security: [{apiKey: [...]}]`      |
| #3 Auth bypass via API key                  | `securitySchemes` + every endpoint's `security` block |
| #7 JWT validation gaps                      | `securitySchemes` JWT section                         |
| #10 OpenAPI spec internal endpoint exposure | All paths matching `/internal*`                       |

Vendor should plan to walk each focus area against the spec before launching
active probes.

---

## 7. Change Log

| Date       | Author | Change                                      |
| ---------- | ------ | ------------------------------------------- |
| 2026-07-29 | Chad   | Initial specification share package defined |
