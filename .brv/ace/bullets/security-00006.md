<!--
WARNING: Do not rename this file manually!
File name: security-00006.md
This file is managed by ByteRover CLI. Only edit the content below.
Renaming this file will break the link to the playbook metadata.
-->

Authentication middleware stack implements comprehensive security: JWT token validation, RBAC with 6-role hierarchy (admin>therapist>researcher>support>patient>guest), 2FA verification, CSRF protection, rate limiting, and security headers. All middleware functions return {success: boolean, request?, response?, error?} pattern for consistent error handling.