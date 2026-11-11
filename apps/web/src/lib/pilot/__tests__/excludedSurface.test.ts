/* @vitest-environment node */

import { describe, expect, it } from 'vitest'

import {
  EXCLUDED_SURFACE_FLAG,
  EXCLUDED_SURFACE_PREFIXES,
  excludedApiRefusal,
  isExcludedSurface,
  isExcludedSurfaceEnabled,
  normalizePathname,
  readRuntimeEnv,
  resolveExcludedSurfaceFlag,
} from '../excludedSurface'

describe('EXCLUDED_SURFACE_PREFIXES', () => {
  it('covers every excluded family measured on the release', () => {
    expect([...EXCLUDED_SURFACE_PREFIXES]).toEqual([
      '/api/ehr',
      '/api/portal',
      '/api/fhir',
      '/portal',
    ])
  })
})

describe('normalizePathname', () => {
  it('collapses duplicate slashes', () => {
    expect(normalizePathname('//api//ehr///v1/patients')).toBe(
      '/api/ehr/v1/patients',
    )
  })

  it('drops trailing slashes', () => {
    expect(normalizePathname('/portal/scheduling/')).toBe('/portal/scheduling')
  })

  it('keeps the root path', () => {
    expect(normalizePathname('/')).toBe('/')
    expect(normalizePathname('')).toBe('/')
  })
})

describe('isExcludedSurface', () => {
  it('matches each prefix exactly', () => {
    for (const prefix of EXCLUDED_SURFACE_PREFIXES) {
      expect(isExcludedSurface(prefix)).toBe(true)
    }
  })

  it('matches nested API routes', () => {
    expect(isExcludedSurface('/api/ehr/v1/patients')).toBe(true)
    expect(isExcludedSurface('/api/ehr/v1/patients/abc')).toBe(true)
    expect(isExcludedSurface('/api/ehr/ai/note-drafting')).toBe(true)
    expect(isExcludedSurface('/api/portal/v1/scheduling')).toBe(true)
    expect(isExcludedSurface('/api/portal/v1/statements/xyz')).toBe(true)
    expect(isExcludedSurface('/api/fhir/r4/metadata')).toBe(true)
  })

  it('matches the client portal pages', () => {
    expect(isExcludedSurface('/portal')).toBe(true)
    expect(isExcludedSurface('/portal/scheduling')).toBe(true)
    expect(isExcludedSurface('/portal/telehealth/')).toBe(true)
  })

  it('does not match a longer segment that merely starts with a prefix', () => {
    expect(isExcludedSurface('/api/ehrfoo')).toBe(false)
    expect(isExcludedSurface('/api/portalx/v1')).toBe(false)
    expect(isExcludedSurface('/portals')).toBe(false)
    expect(isExcludedSurface('/portalx/scheduling')).toBe(false)
  })

  it('does not match the pilot journey surface', () => {
    expect(isExcludedSurface('/api/training/sessions')).toBe(false)
    expect(isExcludedSurface('/api/session/progress')).toBe(false)
    expect(isExcludedSurface('/api/chat/send')).toBe(false)
    expect(isExcludedSurface('/training')).toBe(false)
    expect(isExcludedSurface('/demo-hub')).toBe(false)
    expect(isExcludedSurface('/')).toBe(false)
  })
})

describe('isExcludedSurfaceEnabled', () => {
  it('is off by default and for unset or unexpected values', () => {
    expect(isExcludedSurfaceEnabled(undefined)).toBe(false)
    expect(isExcludedSurfaceEnabled(null)).toBe(false)
    expect(isExcludedSurfaceEnabled('')).toBe(false)
    expect(isExcludedSurfaceEnabled('0')).toBe(false)
    expect(isExcludedSurfaceEnabled('false')).toBe(false)
    expect(isExcludedSurfaceEnabled('yes')).toBe(false)
    expect(isExcludedSurfaceEnabled(true)).toBe(false)
  })

  it('is on for the documented opt-in values', () => {
    expect(isExcludedSurfaceEnabled('1')).toBe(true)
    expect(isExcludedSurfaceEnabled('true')).toBe(true)
    expect(isExcludedSurfaceEnabled(' TRUE ')).toBe(true)
  })
})

describe('resolveExcludedSurfaceFlag', () => {
  it('is off when every source is absent or empty', () => {
    expect(resolveExcludedSurfaceFlag({})).toBe(false)
    expect(
      resolveExcludedSurfaceFlag({
        processEnv: {},
        buildEnv: {},
        runtimeEnv: {},
      }),
    ).toBe(false)
  })

  it('reads the flag from process.env', () => {
    expect(
      resolveExcludedSurfaceFlag({
        processEnv: { [EXCLUDED_SURFACE_FLAG]: '1' },
      }),
    ).toBe(true)
  })

  it('reads the flag from the build-time env', () => {
    expect(
      resolveExcludedSurfaceFlag({
        buildEnv: { [EXCLUDED_SURFACE_FLAG]: 'true' },
      }),
    ).toBe(true)
  })

  it('reads the flag from the adapter runtime env', () => {
    expect(
      resolveExcludedSurfaceFlag({
        runtimeEnv: { [EXCLUDED_SURFACE_FLAG]: '1' },
      }),
    ).toBe(true)
  })

  it('is on when any single source opts in', () => {
    expect(
      resolveExcludedSurfaceFlag({
        processEnv: { [EXCLUDED_SURFACE_FLAG]: '0' },
        runtimeEnv: { [EXCLUDED_SURFACE_FLAG]: '1' },
      }),
    ).toBe(true)
  })

  it('ignores a non-string runtime value', () => {
    expect(
      resolveExcludedSurfaceFlag({
        runtimeEnv: { [EXCLUDED_SURFACE_FLAG]: 1 },
      }),
    ).toBe(false)
  })
})

describe('readRuntimeEnv', () => {
  it('returns undefined for absent or non-object locals', () => {
    expect(readRuntimeEnv(undefined)).toBeUndefined()
    expect(readRuntimeEnv(null)).toBeUndefined()
    expect(readRuntimeEnv('locals')).toBeUndefined()
    expect(readRuntimeEnv({})).toBeUndefined()
  })

  it('returns the adapter env object when present', () => {
    const env = { [EXCLUDED_SURFACE_FLAG]: '1' }

    expect(readRuntimeEnv({ runtime: { env } })).toBe(env)
  })

  it('survives the adapter-14 getter that throws', () => {
    const locals = {
      get runtime(): never {
        throw new Error('runtime is unavailable')
      },
    }

    expect(readRuntimeEnv(locals)).toBeUndefined()
  })
})

describe('excludedApiRefusal', () => {
  it('refuses an excluded API route with a 404 and no payload', () => {
    const refusal = excludedApiRefusal('/api/ehr/v1/patients')

    expect(refusal).not.toBeNull()
    expect(refusal?.status).toBe(404)
    expect(refusal?.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(refusal?.body ?? '{}')).toEqual({
      error: 'not_found',
      message: 'This surface is excluded from the pilot release.',
    })
  })

  it('refuses the public FHIR capability statement too', () => {
    const refusal = excludedApiRefusal('/api/fhir/r4/metadata')

    expect(refusal?.status).toBe(404)
  })

  it('returns no refusal for a page route so middleware can render the 404 page', () => {
    expect(excludedApiRefusal('/portal/scheduling')).toBeNull()
  })

  it('returns no refusal for a non-excluded API route', () => {
    expect(excludedApiRefusal('/api/training/sessions')).toBeNull()
  })
})
