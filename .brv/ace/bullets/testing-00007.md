<!--
WARNING: Do not rename this file manually!
File name: testing-00007.md
This file is managed by ByteRover CLI. Only edit the content below.
Renaming this file will break the link to the playbook metadata.
-->

Authentication tests use vitest with comprehensive mocking: vi.mock() for dependencies (jwt-service, better-auth-integration, redis, security logger). Mock Request/Response objects with proper headers (Authorization: Bearer token, X-CSRF-Token, User-Agent, X-Forwarded-For). Test both success and failure paths, timing attacks prevention, and HIPAA compliance (no PHI in logs).