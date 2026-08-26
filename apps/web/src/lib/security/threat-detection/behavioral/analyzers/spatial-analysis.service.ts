/**
 * Spatial Analysis Service
 * Handles geolocation, IP analysis, and spatial pattern detection
 */

import geoip from 'geoip-lite'

import { generateAnomalyId } from './analyzer-utils'
import type {
  SecurityEvent,
  SpatialFeatures,
  NetworkCharacteristics,
} from './types'

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
    const ipAddresses = events.map((e) => e.sourceIp)
    const locations = await this.geolocateIPs(ipAddresses)

    return {
      ipDiversity: this.calculateIPDiversity(ipAddresses),
      geographicSpread: this.calculateGeographicSpread(locations),
      mobilityPattern: this.calculateMobilityPattern(locations),
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

  private async geolocateIPs(ips: string[]): Promise<GeoLocation[]> {
    const locations: GeoLocation[] = []
    for (const ip of ips) {
      const geo = geoip.lookup(ip)
      if (geo) {
        locations.push({ lat: geo.ll[0], lon: geo.ll[1] })
      }
    }
    return locations
  }

  private calculateIPDiversity(ips: string[]): number {
    return new Set(ips).size
  }

  private calculateGeographicSpread(locations: GeoLocation[]): number {
    if (locations.length < 2) return 0
    let maxDistance = 0
    for (let i = 0; i < locations.length; i++) {
      for (let j = i + 1; j < locations.length; j++) {
        const d = this.haversineDistance(locations[i], locations[j])
        if (d > maxDistance) {
          maxDistance = d
        }
      }
    }
    return maxDistance
  }

  private calculateMobilityPattern(locations: GeoLocation[]): number {
    if (locations.length < 2) return 0
    let totalDistance = 0
    let validPairs = 0
    for (let i = 0; i < locations.length - 1; i++) {
      totalDistance += this.haversineDistance(locations[i], locations[i + 1])
      validPairs++
    }
    return validPairs > 0 ? totalDistance / validPairs : 0
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
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
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
