/**
 * Tests for EHR Native Treatment Plan Suggestions Service (F2.3 / PIX-4412)
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import type { RLSContext } from '@/lib/ehr-native/repositories/base-repository'

// ---------------------------------------------------------------------------
// Fetch mock
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ---------------------------------------------------------------------------
// Dynamic import after mocks are set up (so module-level process.env reads
// see the stubbed env values)
// ---------------------------------------------------------------------------

async function importService() {
  const mod = await import('@/lib/ehr-native/services/treatment-plan.service')
  return mod
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const rlsContext: RLSContext = {
  tenantId: 'tenant-001',
  userId: 'clinician-001',
  role: 'physician',
  breakGlass: false,
}

const validInput = {
  patientId: 'patient-001',
  sessionId: 'session-001',
  icd10Codes: [
    {
      code: 'F32.2',
      description: 'Major depressive disorder, recurrent, moderate',
    },
  ],
}

const apiSuccessResponse = {
  goals: [
    {
      goal: 'Reduce depressive symptoms',
      specific: 'Patient will identify three cognitive distortions per week.',
      measurable: 'PHQ-9 score reduced by at least 5 points.',
      achievable: 'Through weekly CBT sessions and homework.',
      relevant: 'Targets the rumination maintaining the depression.',
      time_bound: 'Within 12 weeks.',
      status: 'proposed',
    },
  ],
  objectives: [
    {
      objective: 'Complete thought records 4 days/week',
      target_date: '2026-09-30',
      status: 'not_started',
      progress_indicator: 'Number of completed thought records',
    },
  ],
  interventions: [
    {
      modality: 'CBT',
      intervention: 'Cognitive restructuring',
      rationale: 'Addresses negative automatic thoughts.',
      frequency: 'Weekly',
      target_goals: ['Reduce depressive symptoms'],
    },
  ],
  summary: '16-week CBT plan targeting rumination.',
  confidence: 0.82,
  warnings: ['Monitor suicidality given F32.2'],
}

const healthResponse = {
  status: 'ok',
  service: 'treatment-plan-suggestions',
  nim_configured: true,
  baa_confirmed: true,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TreatmentPlanService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('TREATMENT_PLAN_API_URL', 'http://test-api:8101')
    vi.stubEnv('TREATMENT_PLAN_TIMEOUT_MS', '30000')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    // The service reads TREATMENT_PLAN_API_URL at module-load time, so we must
    // reset the module registry between tests to let stubbed env vars take effect.
    vi.resetModules()
  })

  // -------------------------------------------------------------------------
  // getSuggestions — happy path
  // -------------------------------------------------------------------------

  describe('getSuggestions — happy path', () => {
    it('returns normalized suggestions on a 200 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => apiSuccessResponse,
      })

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      const result = await service.getSuggestions(validInput)

      expect(result.goals).toHaveLength(1)
      expect(result.goals[0]?.goal).toBe('Reduce depressive symptoms')
      expect(result.goals[0]?.status).toBe('proposed')
      expect(result.objectives[0]?.status).toBe('not_started')
      expect(result.interventions[0]?.modality).toBe('CBT')
      expect(result.summary).toBe('16-week CBT plan targeting rumination.')
      expect(result.confidence).toBe(0.82)
      expect(result.warnings).toEqual(['Monitor suicidality given F32.2'])
    })

    it('sends POST to /suggest with snake_case payload and caller-provided session_id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => apiSuccessResponse,
      })

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      await service.getSuggestions(validInput)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:8101/suggest',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_id: 'patient-001',
            session_id: 'session-001',
            icd10_codes: [
              {
                code: 'F32.2',
                description: 'Major depressive disorder, recurrent, moderate',
              },
            ],
            outcome_trends: [],
            treatment_history: [],
            preferred_modalities: [],
            clinician_notes: '',
          }),
          signal: expect.any(AbortSignal),
        }),
      )
    })

    it('passes optional fields through in payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => apiSuccessResponse,
      })

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      await service.getSuggestions({
        patientId: 'patient-002',
        icd10Codes: [{ code: 'F41.1' }],
        outcomeTrends: [
          {
            measure: 'PHQ-9',
            score: 14,
            measured_at: '2026-08-01',
            trend: 'stable',
          },
        ],
        treatmentHistory: [
          {
            modality: 'CBT',
            start_date: '2026-01-01',
            outcome: 'partial response',
          },
        ],
        preferredModalities: ['CBT', 'DBT'],
        clinicianNotes: 'Patient prefers structured approaches.',
      })

      const call = mockFetch.mock.calls[0]?.[1] as { body?: string }
      const body = JSON.parse(call.body ?? '{}') as Record<string, unknown>
      expect(body['outcome_trends']).toHaveLength(1)
      expect(body['treatment_history']).toHaveLength(1)
      expect(body['preferred_modalities']).toEqual(['CBT', 'DBT'])
      expect(body['clinician_notes']).toBe(
        'Patient prefers structured approaches.',
      )
    })
  })

  // -------------------------------------------------------------------------
  // getSuggestions — response normalization defaults
  // -------------------------------------------------------------------------

  describe('getSuggestions — normalization defaults', () => {
    it('falls back unknown modality to "Supportive"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ...apiSuccessResponse,
          interventions: [
            {
              modality: 'NotAModality',
              intervention: 'x',
              rationale: 'y',
              frequency: 'z',
              target_goals: [],
            },
          ],
        }),
      })

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      const result = await service.getSuggestions(validInput)

      expect(result.interventions[0]?.modality).toBe('Supportive')
    })

    it('falls back unknown goal status to "proposed"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ...apiSuccessResponse,
          goals: [
            {
              goal: 'g',
              specific: 's',
              measurable: 'm',
              achievable: 'a',
              relevant: 'r',
              time_bound: 't',
              status: 'unknown-status',
            },
          ],
        }),
      })

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      const result = await service.getSuggestions(validInput)

      expect(result.goals[0]?.status).toBe('proposed')
    })

    it('falls back unknown objective status to "not_started"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ...apiSuccessResponse,
          objectives: [
            { objective: 'o', target_date: '2026-09-30', status: 'weird' },
          ],
        }),
      })

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      const result = await service.getSuggestions(validInput)

      expect(result.objectives[0]?.status).toBe('not_started')
    })

    it('defaults missing fields to empty values', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      })

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      const result = await service.getSuggestions(validInput)

      expect(result.goals).toEqual([])
      expect(result.objectives).toEqual([])
      expect(result.interventions).toEqual([])
      expect(result.summary).toBe('')
      expect(result.confidence).toBe(0)
      expect(result.warnings).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // getSuggestions — input validation
  // -------------------------------------------------------------------------

  describe('getSuggestions — input validation', () => {
    it('rejects empty patientId with VALIDATION_ERROR', async () => {
      const { TreatmentPlanService, TreatmentPlanError } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      await expect(
        service.getSuggestions({
          patientId: '  ',
          icd10Codes: [{ code: 'F32.2' }],
        }),
      ).rejects.toMatchObject({
        name: 'TreatmentPlanError',
        code: 'VALIDATION_ERROR',
      })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects empty icd10Codes array with VALIDATION_ERROR', async () => {
      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      await expect(
        service.getSuggestions({ patientId: 'p1', icd10Codes: [] }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects more than 20 ICD-10 codes with VALIDATION_ERROR', async () => {
      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      const codes = Array.from({ length: 21 }, (_, i) => ({ code: `F${i}` }))
      await expect(
        service.getSuggestions({ patientId: 'p1', icd10Codes: codes }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects an ICD-10 code with empty string', async () => {
      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      await expect(
        service.getSuggestions({
          patientId: 'p1',
          icd10Codes: [{ code: '   ' }],
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rejects clinicianNotes longer than 5000 characters', async () => {
      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      await expect(
        service.getSuggestions({
          patientId: 'p1',
          icd10Codes: [{ code: 'F32.2' }],
          clinicianNotes: 'a'.repeat(5001),
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('accepts exactly 20 ICD-10 codes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => apiSuccessResponse,
      })
      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      const codes = Array.from({ length: 20 }, (_, i) => ({ code: `F${i}` }))
      const result = await service.getSuggestions({
        patientId: 'p1',
        icd10Codes: codes,
      })
      expect(result.goals).toHaveLength(1)
    })
  })

  // -------------------------------------------------------------------------
  // getSuggestions — HTTP error mapping to TreatmentPlanError codes
  // -------------------------------------------------------------------------

  describe('getSuggestions — HTTP error mapping', () => {
    it('maps 403 to BAA_GATE', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ detail: 'BAA not confirmed for provider' }),
      })

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      await expect(service.getSuggestions(validInput)).rejects.toMatchObject({
        name: 'TreatmentPlanError',
        code: 'BAA_GATE',
        message: 'BAA not confirmed for provider',
      })
    })

    it('maps 422 to VALIDATION_ERROR', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ detail: 'icd10_codes must not be empty' }),
      })

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      await expect(service.getSuggestions(validInput)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      })
    })

    it('maps 502 to NIM_UNAVAILABLE', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({ detail: 'NIM service unreachable' }),
      })

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      await expect(service.getSuggestions(validInput)).rejects.toMatchObject({
        code: 'NIM_UNAVAILABLE',
      })
    })

    it('maps 503 to SERVICE_UNAVAILABLE', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ detail: 'Service temporarily down' }),
      })

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      await expect(service.getSuggestions(validInput)).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      })
    })

    it('maps 500 to SERVICE_ERROR', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Internal error' }),
      })

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      await expect(service.getSuggestions(validInput)).rejects.toMatchObject({
        code: 'SERVICE_ERROR',
      })
    })

    it('uses default detail when body is not JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new SyntaxError('not JSON')
        },
      })

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      await expect(service.getSuggestions(validInput)).rejects.toMatchObject({
        code: 'SERVICE_ERROR',
        message: 'Treatment plan service returned 500',
      })
    })
  })

  // -------------------------------------------------------------------------
  // getSuggestions — timeout and network errors
  // -------------------------------------------------------------------------

  describe('getSuggestions — timeout and network errors', () => {
    it('throws TIMEOUT when AbortController fires', async () => {
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      mockFetch.mockImplementationOnce(async (_url, init) => {
        const signal = (init as { signal?: AbortSignal }).signal
        // Simulate the AbortController firing immediately
        signal?.dispatchEvent?.(new Event('abort'))
        throw abortError
      })

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      await expect(service.getSuggestions(validInput)).rejects.toMatchObject({
        code: 'TIMEOUT',
      })
    })

    it('throws SERVICE_UNAVAILABLE on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      await expect(service.getSuggestions(validInput)).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      })
    })

    it('re-throws TreatmentPlanError unchanged (no double-wrapping)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ detail: 'BAA not confirmed' }),
      })

      const { TreatmentPlanService, TreatmentPlanError } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      let caught: unknown
      try {
        await service.getSuggestions(validInput)
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(TreatmentPlanError)
      expect((caught as { code: string }).code).toBe('BAA_GATE')
    })
  })

  // -------------------------------------------------------------------------
  // getSuggestions — body reading covered by AbortController timeout
  // (PIX-4412 review fix: response body must be read inside try/finally)
  // -------------------------------------------------------------------------

  describe('getSuggestions — body reading timeout coverage', () => {
    it('clears the AbortController timeout after body is fully consumed', async () => {
      // If body reading happened OUTSIDE the try/finally, the AbortController
      // timer would already be cleared before response.json() runs. We assert
      // that body reading happens INSIDE the try block by checking that
      // response.json() is called while the timer is still live.
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
      let jsonCalledBeforeClear = false
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          // At the moment response.json() is invoked, clearTimeout must NOT
          // have been called yet — proves body reading is inside the try block.
          jsonCalledBeforeClear = clearTimeoutSpy.mock.calls.length === 0
          return apiSuccessResponse
        },
      })

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      await service.getSuggestions(validInput)

      expect(jsonCalledBeforeClear).toBe(true)
      // And finally: clearTimeout was eventually called once
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
      clearTimeoutSpy.mockRestore()
    })
  })

  // -------------------------------------------------------------------------
  // checkHealth
  // -------------------------------------------------------------------------

  describe('checkHealth', () => {
    it('returns health status on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => healthResponse,
      })

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      const health = await service.checkHealth()

      expect(health).toEqual(healthResponse)
    })

    it('calls /health endpoint with an AbortSignal', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => healthResponse,
      })

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      await service.checkHealth()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:8101/health',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      )
    })

    it('throws SERVICE_UNAVAILABLE on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      })

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      await expect(service.checkHealth()).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        message: expect.stringContaining('Health check failed'),
      })
    })

    it('throws TIMEOUT on abort', async () => {
      const abortError = new Error('aborted')
      abortError.name = 'AbortError'
      mockFetch.mockImplementationOnce(async (_url, init) => {
        const signal = (init as { signal?: AbortSignal }).signal
        signal?.dispatchEvent?.(new Event('abort'))
        throw abortError
      })

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      await expect(service.checkHealth()).rejects.toMatchObject({
        code: 'TIMEOUT',
      })
    })
  })

  // -------------------------------------------------------------------------
  // TreatmentPlanError class
  // -------------------------------------------------------------------------

  describe('TreatmentPlanError', () => {
    it('exposes the typed code and preserves cause', async () => {
      const { TreatmentPlanError } = await importService()
      const cause = new Error('underlying')
      const err = new TreatmentPlanError('msg', 'NIM_UNAVAILABLE', cause)
      expect(err).toBeInstanceOf(Error)
      expect(err).toBeInstanceOf(TreatmentPlanError)
      expect(err.name).toBe('TreatmentPlanError')
      expect(err.code).toBe('NIM_UNAVAILABLE')
      expect(err.message).toBe('msg')
      expect(err.cause).toBe(cause)
    })

    it('all six error codes are constructible', async () => {
      const { TreatmentPlanError } = await importService()
      const codes = [
        'BAA_GATE',
        'VALIDATION_ERROR',
        'TIMEOUT',
        'SERVICE_UNAVAILABLE',
        'NIM_UNAVAILABLE',
        'SERVICE_ERROR',
      ] as const
      for (const code of codes) {
        const err = new TreatmentPlanError('m', code)
        expect(err.code).toBe(code)
      }
    })
  })

  // -------------------------------------------------------------------------
  // Default configuration (env not set)
  // -------------------------------------------------------------------------

  describe('default configuration', () => {
    it('falls back to http://localhost:8101 when env not set', async () => {
      vi.unstubAllEnvs()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => healthResponse,
      })

      const { TreatmentPlanService } = await importService()
      const service = new TreatmentPlanService(rlsContext)
      await service.checkHealth()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8101/health',
        expect.any(Object),
      )
    })
  })
})
