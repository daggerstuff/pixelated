# Authentication Requirements & Security Audit

## Password Policy
- All user passwords must be at least 8 characters.
- Registration: Passwords are validated using the `zod` schema and hashed with `bcrypt` (cost 12).
- No passwords are stored in plaintext at any point.

## Registration Flow
- Input validation via `zod` for email, password, fullName.
- Duplicate email accounts prevented.
- Audit logs are created for HIPAA compliance.

## Login Flow
- Current implementation in [`login.ts`](src/pages/api/auth/login.ts) does **NOT** check credentials against database or hashed password—THIS IS INCOMPLETE AND A CRITICAL RISK.
- Placeholder logic assigns userId and email directly from input.
- **Requirement:** Login handler must verify user existence and compare bcrypt password hashes before authenticating or issuing sessions/cookies.

## Password Reset/Update
- Reset endpoints validate email, log requests, but actual reset (token/email flow) is not implemented.
- Update endpoint enforces minimum password length and clears recovery cookies via `updatePassword`. Actual hash/storage code is assumed to be in the service.

## Session & JWT/Refresh
- Session/refresh logic in [`refresh.ts`](src/pages/api/auth/refresh.ts) relies on service to return new tokens, sessions, and audit log activity.

## Security Controls
- All authentication flows use structured error handling—no internal data leaked on error by default.
- No hardcoded secrets in endpoints; all secret material is sourced from environment or secure service.
- Audit logging enforced for registration, session activity.
- No monolithic authentication controller found; separation by endpoint.
- No evidence of CSRF tokens or rate limiting in route logic. These controls may be globally handled or are missing; their implementation should be checked in middleware/service.

## Action Items (2025-09-04)
1. **Critical:** Implement real password checking for login endpoint.
2. Verify presence/robustness of CSRF protection and authentication rate limiting.
3. Confirm session/JWT issuance ensures token expiry, rotation, and correct scoping.
4. Ensure password reset flow cannot reveal if email is registered (timing/response parity).
5. Maintain audit logging for all auth flows.

_Last audit: 2025-09-04. See audit history and logs for static code findings and risk notes._