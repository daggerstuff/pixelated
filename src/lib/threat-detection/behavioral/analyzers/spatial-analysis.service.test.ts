import geoip from 'geoip-lite'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { SpatialAnalysisService } from './spatial-analysis.service'

vi.mock('geoip-lite', () => ({
  default: { lookup: vi.fn() },
  lookup: vi.fn(),
}))

const svc = new SpatialAnalysisService()

function makeEvent(sourceIp: string) {
  return { sourceIp, userId: 'u1' } as any
}

function haversine(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('unresolved IP behavior', () => {
  it('skips unresolved IPs instead of mapping them to (0,0)', async () => {
    vi.mocked(geoip.lookup).mockImplementation((ip: string | number) => {
      if (ip === '203.0.113.4') return { ll: [40.0, -75.0] } as any
      return null
    })
    const events = [makeEvent('203.0.113.4'), makeEvent('10.0.0.1')]
    const features = await svc.extractSpatialFeatures(events)
    // only one resolved location -> spread guard (<2) returns 0
    expect(features.geographicSpread).toBe(0)
    // ip diversity counts ALL unique IPs, including unresolved
    expect(features.ipDiversity).toBe(2)
  })

  it('does not distort spread when an IP is unresolved', async () => {
    vi.mocked(geoip.lookup).mockImplementation((ip: string | number) => {
      if (ip === '198.51.100.1') return { ll: [34.0, -118.0] } as any
      if (ip === '198.51.100.2') return { ll: [40.7, -74.0] } as any
      return null
    })
    const events = [
      makeEvent('198.51.100.1'),
      makeEvent('198.51.100.2'),
      makeEvent('10.0.0.9'),
    ]
    const features = await svc.extractSpatialFeatures(events)
    // spread computed from the two resolved IPs only
    expect(features.geographicSpread).toBeGreaterThan(0)
    expect(features.geographicSpread).toBeCloseTo(
      haversine(34.0, -118.0, 40.7, -74.0),
      1,
    )
    expect(features.ipDiversity).toBe(3)
  })
})

describe('metric contract', () => {
  it('returns deterministic spread and mobility for known IPs', async () => {
    vi.mocked(geoip.lookup).mockImplementation((ip: string | number) => {
      if (ip === '198.51.100.1') return { ll: [34.0, -118.0] } as any
      if (ip === '198.51.100.2') return { ll: [40.7, -74.0] } as any
      return null
    })
    const events = [makeEvent('198.51.100.1'), makeEvent('198.51.100.2')]
    const a = await svc.extractSpatialFeatures(events)
    const b = await svc.extractSpatialFeatures(events)
    expect(a.geographicSpread).toBe(b.geographicSpread)
    expect(a.mobilityPattern).toBe(b.mobilityPattern)
  })
})
