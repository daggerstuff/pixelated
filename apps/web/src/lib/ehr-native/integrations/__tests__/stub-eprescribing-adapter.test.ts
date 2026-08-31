/**
 * Tests for StubEPrescribingAdapter controlled-substance gate hardening.
 *
 * The gate must classify medications from the adapter's own drug database
 * and never trust a caller-supplied schedule, so unverified medications
 * cannot bypass DEA/EPCS/PDMP checks.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'

import { StubEPrescribingAdapter } from '../e-prescribing/stub-adapter'
import type { ControlledSubstanceCheckRequest } from '../e-prescribing/types'

function makeRequest(
  overrides: Partial<ControlledSubstanceCheckRequest['medication']> = {},
): ControlledSubstanceCheckRequest {
  return {
    medication: {
      code: '111111',
      name: 'Test medication',
      schedule: 'non-controlled',
      deaNumber: 'AB1234563',
      prescriberNPI: '1234567890',
      ...overrides,
    },
    patientId: 'patient-001',
    prescriberNPI: '1234567890',
  }
}

describe('StubEPrescribingAdapter.checkControlledSubstance', () => {
  const adapter = new StubEPrescribingAdapter()

  it('rejects an unverified code claiming non-controlled', async () => {
    const result = await adapter.checkControlledSubstance(
      makeRequest({ code: '999999' }),
    )

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Unverified medication')
    expect(result.epcsRequired).toBe(true)
  })

  it('classifies from its own database when the caller forges non-controlled', async () => {
    // Oxycodone is Schedule II in the adapter's drug database; a forged
    // 'non-controlled' claim must not bypass the DEA requirement.
    const result = await adapter.checkControlledSubstance(
      makeRequest({
        code: '1043400',
        schedule: 'non-controlled',
        deaNumber: undefined,
      }),
    )

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe(
      'DEA number required for controlled substance prescribing',
    )
  })

  it('allows a database-classified controlled substance with a DEA number', async () => {
    const result = await adapter.checkControlledSubstance(
      makeRequest({ code: '1043400', schedule: 'II' }),
    )

    expect(result.allowed).toBe(true)
    expect(result.pdmpChecked).toBe(true)
    expect(result.epcsRequired).toBe(true)
  })

  it('runs the full gate for an unknown code claiming a controlled schedule', async () => {
    const result = await adapter.checkControlledSubstance(
      makeRequest({ code: '999999', schedule: 'IV', deaNumber: undefined }),
    )

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe(
      'DEA number required for controlled substance prescribing',
    )
  })
})
