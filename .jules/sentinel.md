## 2026-03-05 - [Broken Access Control]
**Vulnerability:** Placeholder authorization middleware in `src/api/routes/documents.ts` were no-ops (`next()`), bypassing all permission checks for document creation, updates, and deletion.
**Learning:** High-level authentication (Astro/Auth0) was implemented, but granular Express-level authorization was left as "security theater" with non-functional placeholders.
**Prevention:** Audit all Express routes for local placeholder definitions of authorization logic and replace with verified middleware from `src/api/middleware/auth.ts`.
## 2026-03-05 - [CI Version Mismatch]
**Vulnerability:** Not a direct vulnerability, but a CI failure due to pnpm version mismatch between `package.json` and various workflow/Docker configurations.
**Learning:** Hardcoded versions in multiple files (`.github/workflows/`, `Dockerfile`, `package.json`) lead to fragile CI pipelines and can block critical security deployments.
**Prevention:** Use environment variables for versions where possible, or ensure `package.json` is the single source of truth that other tools query.
