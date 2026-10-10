import type { APIRoute } from 'astro'

import { AUTH0_ISSUER, SITE_ORIGIN } from '../lib/agent-discovery'

export const GET: APIRoute = () => {
  const markdown = `# auth.md — Pixelated Empathy

You are an agent. This service supports **agentic registration**: discover → register → (claim if needed) → exchange for an access_token → call API → handle revocation. Follow the steps in order; do not skip ahead.

- Resource server: \`${SITE_ORIGIN}\` (this site — a mental-health simulation platform for therapist training)
- Authorization server: \`${AUTH0_ISSUER}\` (Auth0 tenant)

## Step 1 — Discover

The 401 response from any protected API route carries a \`WWW-Authenticate\` header with the PRM URL:

\`\`\`http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="${SITE_ORIGIN}/.well-known/oauth-protected-resource"
\`\`\`

### 1a. Fetch the Protected Resource Metadata

\`\`\`http
GET /.well-known/oauth-protected-resource
\`\`\`

Response shape:

\`\`\`json
{
  "resource": "${SITE_ORIGIN}/",
  "resource_name": "Pixelated Empathy",
  "resource_documentation": "${SITE_ORIGIN}/docs/api",
  "authorization_servers": ["${AUTH0_ISSUER}"],
  "scopes_supported": ["api:read", "profile", "email"],
  "bearer_methods_supported": ["header"]
}
\`\`\`

What each field tells you:

- \`resource\` — the canonical URL of this API. Use this as the \`aud\` when minting an ID-JAG.
- \`authorization_servers\` — the Auth0 issuer that handles registration (see 1b).
- \`scopes_supported\` — scopes this resource server understands.
- \`bearer_methods_supported\` — send the access token as \`Authorization: Bearer …\`.

### 1b. Fetch the Authorization Server metadata

\`\`\`http
GET ${AUTH0_ISSUER}.well-known/oauth-authorization-server
\`\`\`

The authorization server is Auth0. Its discovery document lists the standard endpoints (\`authorization_endpoint\`, \`token_endpoint\`, \`jwks_uri\`, \`grant_types_supported\`).

## Step 2 — Pick a method

1. **You have a session tied to a user identity and can exchange it for an ID-JAG, audience-bound to this service** → identity_assertion (Auth0 client credentials / token exchange).
2. **You are a server-side integration operated by the institution** → service_auth: an institution administrator registers an agent API key.
3. **You have neither** → stop. This service does not support anonymous agent registration; a human must create an account at \`${SITE_ORIGIN}/register\`.

## Step 3 — Register

### service_auth (API key)

Institution administrators create scoped API keys via the authenticated dashboard:

\`\`\`http
POST ${SITE_ORIGIN}/api/v1/auth/api-keys
Authorization: Bearer <admin-access-token>
\`\`\`

The response contains the key (\`X-API-Key\` header style) and its scopes. Keys are revocable by the same administrator.

### identity_assertion (machine-to-machine)

Auth0-registered M2M clients obtain an access token bound to this resource:

\`\`\`http
POST ${AUTH0_ISSUER}oauth/token
Content-Type: application/json

{
  "client_id": "<your-client-id>",
  "client_secret": "<your-client-secret>",
  "audience": "${SITE_ORIGIN}/",
  "grant_type": "client_credentials"
}
\`\`\`

## Step 5 — Exchange / use the access_token

Call the API with the token:

\`\`\`http
GET ${SITE_ORIGIN}/api/v1/scenarios
Authorization: Bearer <access_token>
\`\`\`

For API keys, use the header form instead:

\`\`\`http
X-API-Key: <api-key>
\`\`\`

## Step 6 — Revocation

API keys: \`DELETE ${SITE_ORIGIN}/api/v1/auth/api-keys/{key_id}\` (administrator).
Access tokens: revoke via the authorization server, or let them expire (short-lived by default).
`

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
