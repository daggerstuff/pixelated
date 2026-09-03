/**
 * Additional external threat feed processors.
 * Standalone parsers and threat converters for OTX, VirusTotal, and generic feeds.
 */
import type {
  FeedItem,
  FeedSubscription,
  GlobalThreatIntelligence,
} from '../global/types'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { type FeedProcessor, defaultGlobalThreatFields } from './feed-processors'

const logger = createBuildSafeLogger('external-threat-feed-processors')

// OTX (AlienVault Open Threat Exchange) Feed Processor
export class OTXFeedProcessor implements FeedProcessor {
  async parseFeed(
    data: Record<string, unknown>,
    subscription: FeedSubscription,
  ): Promise<FeedItem[]> {
    try {
      const items: FeedItem[] = []

      // Parse OTX format
      const results = data['results'] as Record<string, unknown>[] | undefined
      if (results) {
        for (const p of results) {
          const pulse = p
          const indicators = pulse['indicators'] as
            | Record<string, unknown>[]
            | undefined
          if (indicators) {
            for (const ind of indicators) {
              const indicator = ind
              items.push({
                itemId: indicator['id'] as string,
                indicator: indicator['indicator'] as string,
                indicatorType: this.mapOTXType(indicator['type'] as string),
                severity: this.mapOTXSeverity(pulse['tlp'] as string),
                confidence: 0.7, // OTX default confidence
                timestamp: new Date(indicator['created'] as string),
                description: (pulse['description'] as string) ?? '',
                source: subscription.provider,
                metadata: {
                  pulseId: pulse['id'] as string,
                  pulseName: pulse['name'] as string,
                  pulseAuthor: pulse['author_name'] as string,
                  tlp: pulse['tlp'],
                  tags: pulse['tags'] ?? [],
                },
              })
            }
          }
        }
      }

      return items
    } catch (error: unknown) {
      logger.error('OTX feed parsing failed:', { error })
      return []
    }
  }

  private mapOTXType(otxType: string): string {
    const typeMap: Record<string, string> = {
      'IPv4': 'ip',
      'domain': 'domain',
      'hostname': 'domain',
      'URL': 'url',
      'FileHash-MD5': 'file_hash',
      'FileHash-SHA1': 'file_hash',
      'FileHash-SHA256': 'file_hash',
      'email': 'email',
    }

    return typeMap[otxType] ?? 'unknown'
  }

  private mapOTXSeverity(tlp: string): string {
    const severityMap: Record<string, string> = {
      white: 'low',
      green: 'medium',
      amber: 'high',
      red: 'critical',
    }

    return severityMap[tlp] ?? 'medium'
  }

  async convertToThreat(
    item: FeedItem,
    subscription: FeedSubscription,
  ): Promise<GlobalThreatIntelligence | null> {
    try {
      const threatId = `external_${item.itemId}`

      return {
        ...defaultGlobalThreatFields(threatId, item.confidence),
        threatId,
        threatType: this.mapIndicatorToThreatType(item.indicatorType),
        severity: item.severity as 'low' | 'medium' | 'high' | 'critical',
        confidence: item.confidence,
        indicators: [
          {
            indicatorType: item.indicatorType,
            value: item.indicator,
            confidence: item.confidence,
            firstSeen: new Date(item.timestamp),
            lastSeen: new Date(item.timestamp),
          },
        ],
        firstSeen: new Date(item.timestamp),
        lastSeen: new Date(item.timestamp),
        regions: ['global'],
        attribution: {
          family: subscription.provider,
          campaign: `otx_${subscription.feedId}`,
          confidence: item.confidence,
        },
        metadata: {
          source: 'external_feed',
          feedId: subscription.feedId,
          provider: subscription.provider,
          itemId: item.itemId,
          description: item.description,
          pulseId: item.metadata?.['pulseId'],
          tags: item.metadata?.['tags'],
        },
      }
    } catch (error: unknown) {
      logger.error('OTX threat conversion failed:', { error })
      return null
    }
  }

  private mapIndicatorToThreatType(indicatorType: string): string {
    const typeMap: Record<string, string> = {
      ip: 'network_intrusion',
      domain: 'c2',
      url: 'malware_distribution',
      file_hash: 'malware',
      email: 'phishing',
      unknown: 'general',
    }

    return typeMap[indicatorType] ?? 'general'
  }
}
// VirusTotal Feed Processor
export class VirusTotalFeedProcessor implements FeedProcessor {
  async parseFeed(
    data: Record<string, unknown>,
    subscription: FeedSubscription,
  ): Promise<FeedItem[]> {
    try {
      const items: FeedItem[] = []

      // Parse VirusTotal format
      const vtData = data['data'] as Record<string, unknown>[] | undefined
      if (vtData) {
        for (const f of vtData) {
          const file = f
          const attrs = file['attributes'] as
            | Record<string, unknown>
            | undefined
          const stats = attrs?.['last_analysis_stats'] as
            | Record<string, unknown>
            | undefined
          if (stats) {
            const maliciousCount = (stats['malicious'] as number) ?? 0
            const totalCount =
              (stats['malicious'] as number) +
              (stats['suspicious'] as number) +
              (stats['undetected'] as number) +
              (stats['harmless'] as number)

            if (maliciousCount > 0) {
              const fileId = file['id'] as string
              items.push({
                itemId: fileId,
                indicator: fileId, // File hash
                indicatorType: this.detectHashType(fileId),
                severity: this.mapVTSeverity(maliciousCount, totalCount),
                confidence: maliciousCount / totalCount,
                timestamp: new Date(
                  (attrs?.['last_analysis_date'] as number) * 1000,
                ),
                description:
                  (attrs?.['meaningful_name'] as string) ?? 'Malicious file',
                source: subscription.provider,
                metadata: {
                  fileName: attrs?.['meaningful_name'] as string,
                  fileSize: attrs?.['size'] as number,
                  fileType: attrs?.['type_description'] as string,
                  maliciousCount,
                  totalCount,
                  vtLink: `https://www.virustotal.com/gui/file/${fileId}`,
                },
              })
            }
          }
        }
      }

      return items
    } catch (error: unknown) {
      logger.error('VirusTotal feed parsing failed:', { error })
      return []
    }
  }

  private detectHashType(hash: string): string {
    if (hash.length === 32) return 'file_hash' // MD5
    if (hash.length === 40) return 'file_hash' // SHA1
    if (hash.length === 64) return 'file_hash' // SHA256
    return 'unknown'
  }

  private mapVTSeverity(malicious: number, total: number): string {
    const ratio = malicious / total
    if (ratio > 0.5) return 'critical'
    if (ratio > 0.2) return 'high'
    if (ratio > 0.05) return 'medium'
    return 'low'
  }

  async convertToThreat(
    item: FeedItem,
    subscription: FeedSubscription,
  ): Promise<GlobalThreatIntelligence | null> {
    try {
      const threatId = `external_${item.itemId}`

      return {
        ...defaultGlobalThreatFields(threatId, item.confidence),
        threatId,
        threatType: 'malware',
        severity: item.severity as 'low' | 'medium' | 'high' | 'critical',
        confidence: item.confidence,
        indicators: [
          {
            indicatorType: item.indicatorType,
            value: item.indicator,
            confidence: item.confidence,
            firstSeen: new Date(item.timestamp),
            lastSeen: new Date(item.timestamp),
          },
        ],
        firstSeen: new Date(item.timestamp),
        lastSeen: new Date(item.timestamp),
        regions: ['global'],
        attribution: {
          family: subscription.provider,
          campaign: `virustotal_${subscription.feedId}`,
          confidence: item.confidence,
        },
        metadata: {
          source: 'external_feed',
          feedId: subscription.feedId,
          provider: subscription.provider,
          itemId: item.itemId,
          description: item.description,
          fileName: item.metadata?.['fileName'],
          fileSize: item.metadata?.['fileSize'],
          fileType: item.metadata?.['fileType'],
          vtLink: item.metadata?.['vtLink'],
        },
      }
    } catch (error: unknown) {
      logger.error('VirusTotal threat conversion failed:', { error })
      return null
    }
  }
}
// Generic Feed Processor
export class GenericFeedProcessor implements FeedProcessor {
  async parseFeed(
    data: Record<string, unknown>,
    subscription: FeedSubscription,
  ): Promise<FeedItem[]> {
    try {
      const items: FeedItem[] = []

      // Handle generic JSON format
      if (Array.isArray(data)) {
        for (const it of data) {
          const item = it as Record<string, unknown>
          if (item['indicator'] || item['value'] || item['ioc']) {
            items.push({
              itemId: (item['id'] ??
                item['indicator'] ??
                item['value'] ??
                item['ioc']) as string,
              indicator: (item['indicator'] ??
                item['value'] ??
                item['ioc']) as string,
              indicatorType: (item['type'] ??
                item['indicator_type'] ??
                'unknown') as string,
              severity: (item['severity'] ??
                item['threat_level'] ??
                'medium') as string,
              confidence: (item['confidence'] ??
                item['reliability'] ??
                0.5) as number,
              timestamp: new Date(
                (item['timestamp'] ?? item['created'] ?? Date.now()) as number,
              ),
              description: (item['description'] ??
                item['notes'] ??
                '') as string,
              source: subscription.provider,
              metadata: {
                rawData: item,
                sourceFormat: 'generic',
              },
            })
          }
        }
      } else {
        const indicators = data['indicators'] as
          | Record<string, unknown>[]
          | undefined
        if (indicators) {
          // Handle nested indicator format
          for (const ind of indicators) {
            const indicator = ind
            items.push({
              itemId: (indicator['id'] ?? indicator['value']) as string,
              indicator: indicator['value'] as string,
              indicatorType: (indicator['type'] ?? 'unknown') as string,
              severity: (indicator['severity'] ?? 'medium') as string,
              confidence: (indicator['confidence'] ?? 0.5) as number,
              timestamp: new Date(
                (indicator['timestamp'] ?? Date.now()) as number,
              ),
              description: (indicator['description'] ?? '') as string,
              source: subscription.provider,
              metadata: {
                rawData: indicator,
                sourceFormat: 'generic_nested',
              },
            })
          }
        }
      }

      return items
    } catch (error: unknown) {
      logger.error('Generic feed parsing failed:', { error })
      return []
    }
  }

  async convertToThreat(
    item: FeedItem,
    subscription: FeedSubscription,
  ): Promise<GlobalThreatIntelligence | null> {
    try {
      const threatId = `external_${item.itemId}`

      return {
        ...defaultGlobalThreatFields(threatId, item.confidence),
        threatId,
        threatType: this.mapGenericToThreatType(item.indicatorType),
        severity: item.severity as 'low' | 'medium' | 'high' | 'critical',
        confidence: item.confidence,
        indicators: [
          {
            indicatorType: item.indicatorType,
            value: item.indicator,
            confidence: item.confidence,
            firstSeen: new Date(item.timestamp),
            lastSeen: new Date(item.timestamp),
          },
        ],
        firstSeen: new Date(item.timestamp),
        lastSeen: new Date(item.timestamp),
        regions: ['global'],
        attribution: {
          family: subscription.provider,
          campaign: `generic_${subscription.feedId}`,
          confidence: item.confidence,
        },
        metadata: {
          source: 'external_feed',
          feedId: subscription.feedId,
          provider: subscription.provider,
          itemId: item.itemId,
          description: item.description,
          rawData: item.metadata?.['rawData'],
        },
      }
    } catch (error: unknown) {
      logger.error('Generic threat conversion failed:', { error })
      return null
    }
  }

  private mapGenericToThreatType(indicatorType: string): string {
    const typeMap: Record<string, string> = {
      ip: 'network_intrusion',
      domain: 'c2',
      url: 'malware_distribution',
      file_hash: 'malware',
      hash: 'malware',
      email: 'phishing',
      unknown: 'general',
    }

    return typeMap[indicatorType] ?? 'general'
  }
}

