/**
 * Spatial Analysis Service
 * Handles geolocation, IP analysis, and spatial pattern detection
 */

import geoip from 'geoip-lite'
// geoip-lite's bundled GeoIP database goes stale over time; refresh it via
// `updatedb` so IP→coordinate mappings stay accurate for threat detection.
import { generateAnomalyId } from './analyzer-utils'

import type {
  SecurityEvent,
  SpatialFeatures,
  NetworkCharacteristics,
} from './types'

// Half Earth circumference (km); ceiling for normalizing spread/mobility to 0–1.
const MAX_GREAT_CIRCLE_KM = 20015

interface GeoLocation {
  lat: number
  lon: number
}

export class SpatialAnalysisService {
  /**
   * Extract spatial features from security events
   */
  async extractSpatialFeatures(
    events: SecurityEvent[],
  ): Promise<SpatialFeatures> {
    // Sort events by timestamp so mobility metrics reflect true chronological order.
    const sortedEvents = [...events].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    )
    const ipAddresses = sortedEvents.map((e) => e.sourceIp)
    // Filter out unresolved IPs (private/loopback/unmapped) so they are excluded
    // from distance calculations instead of being treated as a real coordinate.
    const resolved = (await this.geolocateIPs(ipAddresses)).filter(
      (l): l is GeoLocation => l !== null,
    )

    return {
      ipDiversity: this.calculateIPDiversity(ipAddresses),
      geographicSpread: this.calculateGeographicSpread(resolved),
      mobilityPattern: this.calculateMobilityPattern(resolved),
      networkCharacteristics: this.analyzeNetworkCharacteristics(events),
    }
  }

  /**
   * Detect spatial anomalies by comparing current events against baseline
   */
  async detectSpatialAnomalies(
    baselineMetrics: { geographicThreshold: number },
    events: SecurityEvent[],
  ): Promise<
    Array<{
      anomalyId: string
      userId: string
      patternId: string
      anomalyType: string
      severity: string
      deviationScore: number
      confidence: number
      context: Record<string, unknown>
      timestamp: Date
    }>
  > {
    const anomalies: Array<{
      anomalyId: string
      userId: string
      patternId: string
      anomalyType: string
      severity: string
      deviationScore: number
      confidence: number
      context: Record<string, unknown>
      timestamp: Date
    }> = []

    const spatialFeatures = await this.extractSpatialFeatures(events)

    if (
      spatialFeatures.geographicSpread > baselineMetrics.geographicThreshold
    ) {
      anomalies.push({
        anomalyId: this.generateAnomalyId(),
        userId: events[0]?.userId ?? 'unknown',
        patternId: 'spatial_location',
        anomalyType: 'novelty',
        severity: 'high',
        deviationScore: spatialFeatures.geographicSpread,
        confidence: 0.9,
        context: {
          feature: 'geographicSpread',
          value: spatialFeatures.geographicSpread,
        },
        timestamp: new Date(),
      })
    }

    return anomalies
  }

  private async geolocateIPs(
    ips: string[],
  ): Promise<Array<GeoLocation | null>> {
    return ips.map((ip) => {
      const geo = geoip.lookup(ip)
      if (!geo) {
        // No database entry (private/loopback/unmapped IP); represent as
        // unresolved so callers can exclude it from distance math.
        return null
      }
      return { lat: geo.ll[0], lon: geo.ll[1] }
    })
  }

  private calculateIPDiversity(ips: string[]): number {
    return new Set(ips).size
  }

  private calculateGeographicSpread(locations: GeoLocation[]): number {
    // Deduplicate coordinates so repeated IPs don't inflate the O(n^2) scan.
    const unique = this.dedupeLocations(locations)
    if (unique.length < 2) return 0
    let maxDistance = 0
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const d = this.haversineDistance(unique[i]!, unique[j]!)
        if (d > maxDistance) {
          maxDistance = d
        }
      }
    }
    // Normalize kilometres to a 0–1 dimensionless score (see MAX_GREAT_CIRCLE_KM)
    // so thresholds/ML features calibrated to the prior scale remain valid.
    return maxDistance / MAX_GREAT_CIRCLE_KM
  }

  private dedupeLocations(locations: GeoLocation[]): GeoLocation[] {
    const seen = new Set<string>()
    const result: GeoLocation[] = []
    for (const loc of locations) {
      const key = `${loc.lat.toFixed(4)},${loc.lon.toFixed(4)}`
      if (!seen.has(key)) {
        seen.add(key)
        result.push(loc)
      }
    }
    return result
  }

  private calculateMobilityPattern(locations: GeoLocation[]): number {
    if (locations.length < 2) return 0
    let totalDistance = 0
    let validPairs = 0
    for (let i = 0; i < locations.length - 1; i++) {
      totalDistance += this.haversineDistance(locations[i]!, locations[i + 1]!)
      validPairs++
    }
    const avgKm = validPairs > 0 ? totalDistance / validPairs : 0
    // Normalize to a 0–1 dimensionless score for consistency with geographicSpread.
    return avgKm / MAX_GREAT_CIRCLE_KM
  }

  private haversineDistance(loc1: GeoLocation, loc2: GeoLocation): number {
    const R = 6371 // Radius of the Earth in km
    const dLat = (loc2.lat - loc1.lat) * (Math.PI / 180)
    const dLon = (loc2.lon - loc1.lon) * (Math.PI / 180)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(loc1.lat * (Math.PI / 180)) *
        Math.cos(loc2.lat * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    // Clamp `a` to [0, 1] to avoid NaN from floating-point drift on antipodal points.
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))
    return R * c
  }

  private analyzeNetworkCharacteristics(
    _events: SecurityEvent[],
  ): NetworkCharacteristics {
    return {
      connectionType: 'unknown',
      bandwidthEstimate: 0,
      latency: 0,
    }
  }

  private generateAnomalyId(): string {
    return generateAnomalyId('spatial')
  }
}
