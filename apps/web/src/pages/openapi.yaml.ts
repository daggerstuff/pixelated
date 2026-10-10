import type { APIRoute } from 'astro'

// The OpenAPI spec is authored in src/lib/openapi-spec.ts (generated from
// docs/api/_openapi.yaml) and published at the conventional /openapi.yaml
// URL that agents and the api-catalog expect.
import { OPENAPI_SPEC } from '../lib/openapi-spec'

const headers = {
  'Content-Type': 'application/yaml; charset=utf-8',
  'Cache-Control': 'public, max-age=3600',
}

export const GET: APIRoute = () => new Response(OPENAPI_SPEC, { headers })
