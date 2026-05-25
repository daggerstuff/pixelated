<!-- markdownlint-disable MD013 MD026 -->

## 2026-04-11 - XSS in ChatMessage

- Vulnerability: Unsanitized markdown-to-html rendered via
  `dangerouslySetInnerHTML`.
- Learning: Custom markdown parsers can have edge cases that bypass XSS
  protections.
- Prevention: Always use isomorphic-dompurify or dompurify when setting inner
  HTML, even after custom markdown parsing.

## 2026-04-11 - XSS in inline JSON-LD and script blocks

- Vulnerability: Unescaped HTML control characters injected via `set:html` with
  `JSON.stringify`.
- Learning: `JSON.stringify` is unsafe for inline script blocks and JSON-LD
  without escaping `<` and `>`.
- Prevention: Always escape HTML control characters in serialized JSON before
  `set:html`, e.g. `replace(/</g, '\\u003c').replace(/>/g, '\\u003e')`.

## 2026-04-15 - XSS in Training Session Astro View

- Vulnerability: Unsanitized `JSON.stringify` inside script tags using
  `set:html`.
- Learning: Same JSON-in-script breakout risk as other Astro views.
- Prevention: Escape HTML control characters in `JSON.stringify` output before
  injecting into script tags.

## 2026-04-17 - Missing Authentication on Strategy Endpoints

- Vulnerability: Unauthenticated access to sensitive business strategy dashboard
  and operations.
- Learning: New route files must explicitly import and use authentication
  middleware if not globally applied in the router.
- Prevention: Always review endpoint definitions for missing `authenticateToken`
  middleware.

## 2026-04-28 - XSS in CardItem.astro via unsanitized set:html

- Vulnerability: HTML content and details from collections were injected
  directly via `set:html` without sanitization.
- Learning: Any user-provided or CMS-sourced HTML passed to `set:html` must be
  sanitized to prevent XSS.
- Prevention: Always sanitize HTML strings with DOMPurify before using
  `set:html` in Astro components.

## 2026-05-11 - XSS in GithubItem

- Vulnerability: Unsanitized `set:html` for GitHub release/PR descriptions.
- Learning: External data sources like the GitHub API can contain malicious
  payloads and must be sanitized before rendering.
- Prevention: Always use DOMPurify when setting HTML from external sources.

## 2024-05-17 - Missing Auth on Chat API Endpoint

- Vulnerability: Unauthenticated POST requests were accepted at `/api/chat`,
  allowing anyone to submit messages by supplying an arbitrary `userId` in the
  payload without a valid session or token.
- Learning: Global middleware (e.g. `src/middleware.ts`) may have explicit route
  patterns that do not cover all API endpoints. When an endpoint is
  intentionally left out of standard JWT patterns or the middleware
  configuration misses it, we must fall back to explicit checks in the endpoint
  handler.
- Prevention: Always verify authentication either through the central middleware
  or explicitly within the route handler (e.g., using
  `verifyAuthToken(authHeader)`), and enforce proper error handling for
  missing/invalid tokens.

## 2024-05-24 - XSS in Warning Component | Vulnerability: Unsanitized raw HTML content passed to `set:html` in `Warning.astro`. | Learning: Reusable UI components that accept raw HTML props can be used in multiple places and pass unsanitized input to `set:html`, enabling XSS. | Prevention: Always sanitize raw HTML props using `DOMPurify` before injecting them via `set:html` in shared UI components.
