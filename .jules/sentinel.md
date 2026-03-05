## 2026-03-05 - [Broken Access Control]
**Vulnerability:** Placeholder authorization middleware in `src/api/routes/documents.ts` were no-ops (`next()`), bypassing all permission checks for document creation, updates, and deletion.
**Learning:** High-level authentication (Astro/Auth0) was implemented, but granular Express-level authorization was left as "security theater" with non-functional placeholders.
**Prevention:** Audit all Express routes for local placeholder definitions of authorization logic and replace with verified middleware from `src/api/middleware/auth.ts`.
