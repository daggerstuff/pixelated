/**
 * FHIR R4 CapabilityStatement Endpoint
 *
 * GET /api/fhir/r4/metadata
 *
 * Returns a FHIR R4 CapabilityStatement that declares only the resources
 * and operations actually implemented in the EHR module.
 *
 * Per ADR-002: FHIR R4 validated with Zod.
 * Per task PIX-4408: Must validate against FHIR R4 profile.
 */
import { generateCapabilityStatement } from '@/lib/ehr-native/api/capability-statement'

/**
 * GET /api/fhir/r4/metadata
 *
 * FHIR R4 requires this endpoint to be available without authentication.
 * It returns the server's capabilities as a CapabilityStatement resource.
 */
export async function GET(): Promise<Response> {
  const statement = generateCapabilityStatement()

  return new Response(JSON.stringify(statement), {
    status: 200,
    headers: {
      'Content-Type': 'application/fhir+json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
