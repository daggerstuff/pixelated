/**
 * External threat feed processors.
 * Standalone parsers and threat converters for STIX, TAXII, and MISP feeds.
 */
import type {
  FeedItem,
  FeedSubscription,
  GlobalThreatIntelligence,
} from '../global/types'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('external-threat-feed-processors')

export interface FeedProcessor {
  parseFeed(
    data: Record<string, unknown>,
    subscription: FeedSubscription,
  ): Promise<FeedItem[]>
  convertToThreat(
    item: FeedItem,
    subscription: FeedSubscription,
  ): Promise<GlobalThreatIntelligence | null>
}

export function defaultGlobalThreatFields(
  threatId: string,
  confidence: number,
): Pick<
  GlobalThreatIntelligence,
  'intelligenceId' | 'impactAssessment' | 'correlationData' | 'validationStatus'
> {
  const now = new Date()
  return {
    intelligenceId: `intel_${threatId}`,
    impactAssessment: {
      geographicSpread: 0,
      affectedRegions: ['global'],
      affectedSectors: [],
      potentialImpact: 0,
    },
    correlationData: {
      correlationId: `corr_${threatId}`,
      correlatedThreats: [],
      correlationStrength: 0,
      correlationType: 'feed',
      confidence,
      analysisMethod: 'external_feed',
      timestamp: now,
    },
    validationStatus: {
      validationId: `val_${threatId}`,
      status: 'pending',
      accuracy: 0,
      completeness: 0,
      consistency: 0,
      timeliness: 0,
      relevance: 0,
      validator: 'external_feed',
      validationDate: now,
      feedback: [],
    },
  }
}
// STIX Feed Processor
export class STIXFeedProcessor implements FeedProcessor {
  async parseFeed(
    data: Record<string, unknown>,
    subscription: FeedSubscription,
  ): Promise<FeedItem[]> {
    try {
      const items: FeedItem[] = []

      // Parse STIX 2.x format
      const objects = data['objects'] as Record<string, unknown>[] | undefined
      if (objects) {
        for (const obj of objects) {
          if (obj['type'] === 'indicator') {
            items.push({
              itemId: obj['id'] as string,
              indicator: obj['pattern'] as string,
              indicatorType: this.extractIndicatorType(
                obj['pattern'] as string,
              ),
              severity: this.mapSTIXThreatLevel(obj['labels'] as string[]),
              confidence: (obj['confidence'] as number) ?? 0.5,
              timestamp: new Date(obj['created'] as string),
              description: (obj['description'] as string) ?? '',
              source: subscription.provider,
              metadata: {
                stixVersion: data['spec_version'] as string,
                objectType: obj['type'],
                labels: obj['labels'],
              },
            })
          }
        }
      }

      return items
    } catch (error: unknown) {
      logger.error('STIX feed parsing failed:', { error })
      return []
    }
  }

  private extractIndicatorType(pattern: string): string {
    if (pattern.includes('file:hashes')) return 'file_hash'
    if (pattern.includes('ipv4-addr')) return 'ip'
    if (pattern.includes('domain-name')) return 'domain'
    if (pattern.includes('url')) return 'url'
    return 'unknown'
  }

  private mapSTIXThreatLevel(labels: string[]): string {
    if (labels.includes('malicious-activity')) return 'high'
    if (labels.includes('suspicious-activity')) return 'medium'
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
          campaign: `feed_${subscription.feedId}`,
          confidence: item.confidence,
        },
        metadata: {
          source: 'external_feed',
          feedId: subscription.feedId,
          provider: subscription.provider,
          itemId: item.itemId,
          description: item.description,
        },
      }
    } catch (error: unknown) {
      logger.error('STIX threat conversion failed:', { error })
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
// TAXII Feed Processor
export class TAXIIFeedProcessor implements FeedProcessor {
  async parseFeed(
    data: Record<string, unknown>,
    subscription: FeedSubscription,
  ): Promise<FeedItem[]> {
    try {
      const items: FeedItem[] = []

      // Parse TAXII 2.x format
      const objects = data['objects'] as Record<string, unknown>[] | undefined
      if (objects) {
        for (const obj of objects) {
          const o = obj
          if (
            o['type'] === 'indicator' ||
            o['type'] === 'malware' ||
            o['type'] === 'attack-pattern'
          ) {
            items.push({
              itemId: o['id'] as string,
              indicator: this.extractIndicatorFromTAXII(o),
              indicatorType: this.extractIndicatorTypeFromTAXII(o),
              severity: this.mapTAXIIThreatLevel(o),
              confidence: (o['confidence'] as number) ?? 0.5,
              timestamp: new Date(o['created'] as string),
              description: (o['description'] as string) ?? '',
              source: subscription.provider,
              metadata: {
                taxiiVersion: data['spec_version'] as string,
                objectType: o['type'],
                labels: o['labels'] ?? [],
              },
            })
          }
        }
      }

      return items
    } catch (error: unknown) {
      logger.error('TAXII feed parsing failed:', { error })
      return []
    }
  }

  private extractIndicatorFromTAXII(obj: Record<string, unknown>): string {
    if (obj['pattern']) return obj['pattern'] as string
    if (obj['name']) return obj['name'] as string
    const extRefs = obj['external_references'] as
      | Record<string, unknown>[]
      | undefined
    if (extRefs && extRefs.length > 0) {
      return (
        (extRefs[0]['url'] as string) ?? (extRefs[0]['external_id'] as string)
      )
    }
    return obj['id'] as string
  }

  private extractIndicatorTypeFromTAXII(obj: Record<string, unknown>): string {
    const pattern = obj['pattern'] as string
    if (pattern) {
      if (pattern.includes('file:hashes')) return 'file_hash'
      if (pattern.includes('ipv4-addr')) return 'ip'
      if (pattern.includes('domain-name')) return 'domain'
      if (pattern.includes('url')) return 'url'
    }
    return 'unknown'
  }

  private mapTAXIIThreatLevel(obj: Record<string, unknown>): string {
    const labels = obj['labels'] as string[] | undefined
    if (labels?.includes('malicious-activity')) return 'high'
    if (labels?.includes('suspicious-activity')) return 'medium'
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
          campaign: `taxii_${subscription.feedId}`,
          confidence: item.confidence,
        },
        metadata: {
          source: 'external_feed',
          feedId: subscription.feedId,
          provider: subscription.provider,
          itemId: item.itemId,
          description: item.description,
        },
      }
    } catch (error: unknown) {
      logger.error('TAXII threat conversion failed:', { error })
      return null
    }
  }

  private mapIndicatorToThreatType(indicatorType: string): string {
    const typeMap: Record<string, string> = {
      ip: 'network_intrusion',
      domain: 'c2',
      url: 'malware_distribution',
      file_hash: 'malware',
      unknown: 'general',
    }

    return typeMap[indicatorType] ?? 'general'
  }
}
// MISP Feed Processor
export class MISPFeedProcessor implements FeedProcessor {
  async parseFeed(
    data: Record<string, unknown>,
    subscription: FeedSubscription,
  ): Promise<FeedItem[]> {
    try {
      const items: FeedItem[] = []

      // Parse MISP format
      const response = data['response'] as Record<string, unknown>[] | undefined
      if (response) {
        for (const evt of response) {
          const event = evt
          const attr = (event['Event'] as Record<string, unknown>)?.[
            'Attribute'
          ] as Record<string, unknown>[] | undefined
          if (attr) {
            for (const att of attr) {
              const attribute = att
              items.push({
                itemId: attribute['id'] as string,
                indicator: attribute['value'] as string,
                indicatorType: this.mapMISPType(attribute['type'] as string),
                severity: this.mapMISPSeverity(attribute['comment'] as string),
                confidence: this.mapMISPConfidence(
                  attribute['comment'] as string,
                ),
                timestamp: new Date((attribute['timestamp'] as number) * 1000),
                description: (attribute['comment'] as string) ?? '',
                source: subscription.provider,
                metadata: {
                  eventId: (event['Event'] as Record<string, unknown>)[
                    'id'
                  ] as string,
                  eventInfo: (event['Event'] as Record<string, unknown>)[
                    'info'
                  ] as string,
                  category: attribute['category'] as string,
                  type: attribute['type'],
                },
              })
            }
          }
        }
      }

      return items
    } catch (error: unknown) {
      logger.error('MISP feed parsing failed:', { error })
      return []
    }
  }

  private mapMISPType(mispType: string): string {
    const typeMap: Record<string, string> = {
      'ip-dst': 'ip',
      'ip-src': 'ip',
      'domain': 'domain',
      'url': 'url',
      'md5': 'file_hash',
      'sha1': 'file_hash',
      'sha256': 'file_hash',
      'filename': 'file_name',
      'email': 'email',
    }

    return typeMap[mispType] ?? 'unknown'
  }

  private mapMISPSeverity(comment: string): string {
    if (comment.includes('critical') || comment.includes('high'))
      return 'critical'
    if (comment.includes('medium')) return 'medium'
    return 'low'
  }

  private mapMISPConfidence(comment: string): number {
    if (comment.includes('high confidence')) return 0.9
    if (comment.includes('medium confidence')) return 0.6
    if (comment.includes('low confidence')) return 0.3
    return 0.5
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
          campaign: `misp_${subscription.feedId}`,
          confidence: item.confidence,
        },
        metadata: {
          source: 'external_feed',
          feedId: subscription.feedId,
          provider: subscription.provider,
          itemId: item.itemId,
          description: item.description,
          eventId: item.metadata?.['eventId'],
        },
      }
    } catch (error: unknown) {
      logger.error('MISP threat conversion failed:', { error })
      return null
    }
  }

  private mapIndicatorToThreatType(indicatorType: string): string {
    const typeMap: Record<string, string> = {
      ip: 'network_intrusion',
      domain: 'c2',
      url: 'malware_distribution',
      file_hash: 'malware',
      file_name: 'malware',
      email: 'phishing',
      unknown: 'general',
    }

    return typeMap[indicatorType] ?? 'general'
  }
}

