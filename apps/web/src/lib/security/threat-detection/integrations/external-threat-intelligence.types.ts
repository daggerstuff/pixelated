/**
 * External threat intelligence types — extracted from
 * external-threat-intelligence.ts.
 */

export interface ThreatIntelligenceConfig {
  enabled: boolean
  feeds: ThreatIntelligenceFeed[]
  updateInterval: number // milliseconds
  cacheTimeout: number // milliseconds
  apiKeys: Record<string, string>
  mongoUrl?: string
  redisUrl?: string
  proxyConfig?: {
    host: string
    port: number
    auth?: {
      username: string
      password: string
    }
  }
}

export interface ThreatIntelligenceFeed {
  name: string
  type: 'commercial' | 'open_source' | 'community'
  url: string
  apiKey?: string
  authType: 'none' | 'api_key' | 'bearer' | 'basic'
  rateLimit: {
    requestsPerMinute: number
    burstLimit: number
  }
  supportedIOCTypes: string[]
  updateFrequency: number // milliseconds
  enabled: boolean
  priority: number
}

export interface ThreatIntelligence {
  intelligenceId: string
  feedName: string
  iocType: string
  iocValue: string
  threatType: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  firstSeen: Date
  lastSeen: Date
  expirationDate?: Date
  source: string
  tags: string[]
  metadata: Record<string, unknown>
  relatedIOCs?: string[]
  attribution?: {
    actor: string
    campaign: string
    family: string
  }
}

export interface ThreatIntelligenceQuery {
  iocType?: string
  iocValue?: string
  threatType?: string
  severity?: string
  tags?: string[]
  source?: string
  timeRange?: {
    start: Date
    end: Date
  }
}

export interface ThreatIntelligenceResult {
  intelligence: ThreatIntelligence[]
  totalCount: number
  sources: string[]
  queryTime: Date
  cacheHit: boolean
}

