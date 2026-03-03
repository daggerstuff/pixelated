# Sentinel Journal - Security Learnings

## 2025-05-15 - Fixing Broken Access Control in Document Routes

**Vulnerability:** Document management routes (`/api/documents`) were using mock authorization middlewares (`requirePermission`, `requireRole`) that always called `next()`, bypassing all permission and role checks. This allowed any authenticated user to create, update, or delete documents regardless of their actual permissions.

**Learning:** During rapid development or migration, developers may use "temporary placeholder" middlewares to bypass authentication/authorization blocks. These placeholders are high-risk security gaps if not properly replaced before deployment. In this case, the legacy Auth0 middleware was commented out and replaced with these mocks.

**Prevention:**
1. Always use a centralized authorization middleware and avoid defining ad-hoc or local mock middlewares in route files.
2. Implement automated security tests that specifically target authorization logic (e.g., attempting restricted actions with low-privilege users).
3. Use linting or static analysis rules to flag "TODO" or "temporary" bypasses in security-critical code paths.
4. Standardize the data shape for user roles and permissions (e.g., ensuring both `user.role` and `user.roles` are handled) to prevent authorization failures due to mismatched data structures.
