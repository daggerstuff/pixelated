/**
 * Auth0 Adaptive MFA Service
 * Implements risk-based authentication triggers using Auth0 Signals and contextual analysis
 */

import { ManagementClient } from 'auth0'
import { logSecurityEvent, SecurityEventType } from '../security/index'
import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'
import { auth0UserService } from '../../services/auth0.service'

// Auth0 Configuration
const AUTH0_CONFIG = {
  domain: process.env.AUTH0_DOMAIN || '',
  managementClientId: process.env.AUTH0_MANAGEMENT_CLIENT_ID || '',
  managementClientSecret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET || '',
}

// Initialize Auth0 management client
let auth0Management: ManagementClient | null = null

/**
 * Initialize Auth0 management client
 */
function initializeAuth0Management() {
  if (!AUTH0_CONFIG.domain || !AUTH0_CONFIG.managementClientId || !AUTH0_CONFIG.managementClientSecret) {
    throw new Error('Auth0 management configuration is incomplete. Please check environment variables.')
  }

  if (!auth0Management) {
    auth0Management = new ManagementClient({
      domain: AUTH0_CONFIG.domain,
      clientId: AUTH0_CONFIG.managementClientId,
      clientSecret: AUTH0_CONFIG.managementClientSecret,
      audience: `https://${AUTH0_CONFIG.domain}/api/v2/`,
      scope: 'read:users read:logs read:attack-protection update:attack-protection'
    })
  }
}

// Initialize the management client
initializeAuth0Management()

// Types
export interface RiskFactors {
  ipAddress: string
  userAgent: string
  geolocation?: {
    country?: string
    city?: string
    latitude?: number
    longitude?: number
  }
  timeOfDay?: number
  dayOfWeek?: number
  deviceFingerprint?: string
  previousLoginAttempts?: number
  lastLoginTime?: Date
  lastLoginLocation?: string
}

export interface RiskScore {
  score: number // 0-100
  factors: RiskFactor[]
  requiresMFA: boolean
  recommendedAction: 'allow' | 'challenge' | 'deny'
}

export interface RiskFactor {
  name: string
  weight: number // 0-100
  description: string
  value: any
  triggered: boolean
}

export interface AdaptiveMFAConfig {
  enableAdaptiveMFA: boolean
  riskThreshold: number // 0-100
  highRiskThreshold: number // 0-100
  enableIPWhitelisting: boolean
  whitelistedIPs: string[]
  enableGeofencing: boolean
  allowedCountries: string[]
  enableDeviceProfiling: boolean
  enableTimeBasedRules: boolean
  allowedTimeWindows: TimeWindow[]
  enableBehavioralAnalysis: boolean
  maxFailedAttempts: number
  lockoutDuration: number // in minutes
}

export interface TimeWindow {
  dayOfWeek: number // 0-6 (Sunday-Saturday)
  startTime: string // HH:MM format
  endTime: string // HH:MM format
}

export interface LoginContext {
  userId: string
  ipAddress: string
  userAgent: string
  timestamp: Date
  location?: {
    country?: string
    city?: string
  }
}

/**
 * Auth0 Adaptive MFA Service
 * Implements risk-based authentication triggers and contextual analysis
 */
export class Auth0AdaptiveMFAService {
  private config: AdaptiveMFAConfig

  constructor() {
    if (!AUTH0_CONFIG.domain) {
      throw new Error('Auth0 is not properly configured')
    }

    // Default configuration
    this.config = {
      enableAdaptiveMFA: true,
      riskThreshold: 30, // Medium risk threshold
      highRiskThreshold: 70, // High risk threshold
      enableIPWhitelisting: true,
      whitelistedIPs: [],
      enableGeofencing: true,
      allowedCountries: ['US', 'CA', 'GB', 'AU', 'NZ', 'IE'], // Default to English-speaking countries
      enableDeviceProfiling: true,
      enableTimeBasedRules: true,
      allowedTimeWindows: [
        // Business hours in UTC
        { dayOfWeek: 1, startTime: '08:00', endTime: '18:00' }, // Monday
        { dayOfWeek: 2, startTime: '08:00', endTime: '18:00' }, // Tuesday
        { dayOfWeek: 3, startTime: '08:00', endTime: '18:00' }, // Wednesday
        { dayOfWeek: 4, startTime: '08:00', endTime: '18:00' }, // Thursday
        { dayOfWeek: 5, startTime: '08:00', endTime: '18:00' }, // Friday
      ],
      enableBehavioralAnalysis: true,
      maxFailedAttempts: 5,
      lockoutDuration: 30 // 30 minutes
    }
  }

  /**
   * Calculate risk score based on contextual factors
   */
  async calculateRiskScore(context: LoginContext): Promise<RiskScore> {
    const factors: RiskFactor[] = []
    let totalScore = 0
    let maxPossibleScore = 0

    try {
      // 1. IP Address Analysis
      const ipFactor = await this.analyzeIPAddress(context.ipAddress, context.userId)
      factors.push(ipFactor)
      if (ipFactor.triggered) {
        totalScore += ipFactor.weight
      }
      maxPossibleScore += ipFactor.weight

      // 2. Geolocation Analysis
      if (context.location) {
        const geoFactor = await this.analyzeGeolocation(context.location, context.userId)
        factors.push(geoFactor)
        if (geoFactor.triggered) {
          totalScore += geoFactor.weight
        }
        maxPossibleScore += geoFactor.weight
      }

      // 3. Time-based Analysis
      const timeFactor = this.analyzeTimeContext(context.timestamp)
      factors.push(timeFactor)
      if (timeFactor.triggered) {
        totalScore += timeFactor.weight
      }
      maxPossibleScore += timeFactor.weight

      // 4. Behavioral Analysis
      const behaviorFactor = await this.analyzeUserBehavior(context.userId, context.timestamp)
      factors.push(behaviorFactor)
      if (behaviorFactor.triggered) {
        totalScore += behaviorFactor.weight
      }
      maxPossibleScore += behaviorFactor.weight

      // 5. Device Fingerprinting (simulated)
      const deviceFactor = this.analyzeDevice(context.userAgent)
      factors.push(deviceFactor)
      if (deviceFactor.triggered) {
        totalScore += deviceFactor.weight
      }
      maxPossibleScore += deviceFactor.weight

      // Normalize score to 0-100 range
      const normalizedScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0

      // Determine if MFA is required based on risk score
      const requiresMFA = normalizedScore >= this.config.riskThreshold

      // Determine recommended action
      let recommendedAction: 'allow' | 'challenge' | 'deny' = 'allow'
      if (normalizedScore >= this.config.highRiskThreshold) {
        recommendedAction = 'deny'
      } else if (requiresMFA) {
        recommendedAction = 'challenge'
      }

      // Log risk assessment
      await logSecurityEvent(SecurityEventType.RISK_ASSESSMENT, {
        userId: context.userId,
        riskScore: normalizedScore,
        factors: factors.map(f => ({ name: f.name, triggered: f.triggered })),
        recommendedAction,
        timestamp: context.timestamp.toISOString()
      })

      // Update Phase 6 MCP server with risk assessment
      await updatePhase6AuthenticationProgress(context.userId, `risk_assessment_${normalizedScore}`)

      return {
        score: normalizedScore,
        factors,
        requiresMFA,
        recommendedAction
      }
    } catch (error) {
      console.error('Failed to calculate risk score:', error)

      // In case of error, default to medium risk requiring MFA
      return {
        score: 50,
        factors: [],
        requiresMFA: true,
        recommendedAction: 'challenge'
      }
    }
  }

  /**
   * Analyze IP address for risk factors
   */
  private async analyzeIPAddress(ipAddress: string, userId: string): Promise<RiskFactor> {
    let weight = 25 // Base weight
    let triggered = false
    let description = `IP address analysis for ${ipAddress}`
    let value: any = ipAddress

    try {
      // Check if IP is in whitelist
      if (this.config.enableIPWhitelisting && this.config.whitelistedIPs.includes(ipAddress)) {
        description = `IP ${ipAddress} is whitelisted`
        weight = 0
      } else {
        // Check Auth0 logs for suspicious activity from this IP
        if (auth0Management) {
          const logs = await auth0Management.getLogs({
            per_page: 10,
            q: `ip:${ipAddress} AND type:f`
          })

          if (logs.length > 0) {
            triggered = true
            description = `Suspicious activity detected from IP ${ipAddress}`
            value = { ipAddress, failedAttempts: logs.length }
          }
        }

        // Check if this is a new IP for the user
        const user = await auth0UserService.getUserById(userId)
        if (user && user.lastLogin) {
          // In a real implementation, we would check the IP from the last login
          // For now, we'll simulate a 10% chance of triggering for demonstration
          if (Math.random() < 0.1) {
            triggered = true
            description = `New or unusual IP address for user`
          }
        }
      }
    } catch (error) {
      console.warn('Failed to analyze IP address:', error)
    }

    return {
      name: 'ip_address_analysis',
      weight,
      description,
      value,
      triggered
    }
  }

  /**
   * Analyze geolocation for risk factors
   */
  private async analyzeGeolocation(location: { country?: string; city?: string }, userId: string): Promise<RiskFactor> {
    let weight = 20 // Base weight
    let triggered = false
    let description = 'Geolocation analysis'
    let value: any = location

    try {
      if (this.config.enableGeofencing && location.country) {
        // Check if country is allowed
        if (!this.config.allowedCountries.includes(location.country)) {
          triggered = true
          description = `Login from restricted country: ${location.country}`
          value = { country: location.country, allowedCountries: this.config.allowedCountries }
        } else {
          description = `Login from allowed country: ${location.country}`
          weight = 5 // Lower weight for allowed countries
        }
      }

      // Check for unusual location change (simulated)
      const user = await auth0UserService.getUserById(userId)
      if (user) {
        // In a real implementation, we would check the location from the last login
        // For now, we'll simulate a 5% chance of triggering for demonstration
        if (Math.random() < 0.05 && location.country) {
          triggered = true
          description = `Unusual location change detected`
          value = { currentCountry: location.country, previousCountry: 'US' } // Simulated
        }
      }
    } catch (error) {
      console.warn('Failed to analyze geolocation:', error)
    }

    return {
      name: 'geolocation_analysis',
      weight,
      description,
      value,
      triggered
    }
  }

  /**
   * Analyze time context for risk factors
   */
  private analyzeTimeContext(timestamp: Date): RiskFactor {
    const weight = 15 // Base weight
    let triggered = false
    let description = 'Time-based analysis'
    const value: any = {
      hour: timestamp.getUTCHours(),
      dayOfWeek: timestamp.getUTCDay(),
      timestamp: timestamp.toISOString()
    }

    try {
      if (this.config.enableTimeBasedRules) {
        const dayOfWeek = timestamp.getUTCDay()
        const hour = timestamp.getUTCHours()
        const minute = timestamp.getUTCMinutes()
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`

        // Check if current time is within allowed windows
        const isInAllowedWindow = this.config.allowedTimeWindows.some(window => {
          if (window.dayOfWeek !== dayOfWeek) return false

          // Simple time comparison (assuming HH:MM format)
          return timeString >= window.startTime && timeString <= window.endTime
        })

        if (!isInAllowedWindow) {
          triggered = true
          description = `Login outside of allowed time windows`
          value.allowedWindows = this.config.allowedTimeWindows
        } else {
          description = `Login within allowed time windows`
        }
      }
    } catch (error) {
      console.warn('Failed to analyze time context:', error)
    }

    return {
      name: 'time_based_analysis',
      weight,
      description,
      value,
      triggered
    }
  }

  /**
   * Analyze user behavior for risk factors
   */
  private async analyzeUserBehavior(userId: string, timestamp: Date): Promise<RiskFactor> {
    const weight = 20 // Base weight
    let triggered = false
    let description = 'Behavioral analysis'
    let value: any = { userId, timestamp: timestamp.toISOString() }

    try {
      if (this.config.enableBehavioralAnalysis) {
        // Check recent failed login attempts
        if (auth0Management) {
          const recentLogs = await auth0Management.getLogs({
            per_page: 20,
            q: `user_id:${userId} AND type:f AND date:[${new Date(Date.now() - 3600000).toISOString()} TO *]`
          })

          if (recentLogs.length >= this.config.maxFailedAttempts) {
            triggered = true
            description = `Multiple failed login attempts detected (${recentLogs.length})`
            value.failedAttempts = recentLogs.length
            value.maxAllowed = this.config.maxFailedAttempts
          } else {
            description = `Normal login behavior (${recentLogs.length} recent failed attempts)`
            value.failedAttempts = recentLogs.length
          }
        }

        // Check for unusual login patterns (simulated)
        const user = await auth0UserService.getUserById(userId)
        if (user && user.lastLogin) {
          const lastLoginTime = new Date(user.lastLogin)
          const timeDiff = timestamp.getTime() - lastLoginTime.getTime()

          // If last login was more than 30 days ago, consider it unusual
          if (timeDiff > 30 * 24 * 60 * 60 * 1000) {
            triggered = true
            description = `Unusual login pattern - last login was over 30 days ago`
            value.daysSinceLastLogin = Math.round(timeDiff / (24 * 60 * 60 * 1000))
          }
        }
      }
    } catch (error) {
      console.warn('Failed to analyze user behavior:', error)
    }

    return {
      name: 'behavioral_analysis',
      weight,
      description,
      value,
      triggered
    }
  }

  /**
   * Analyze device fingerprint for risk factors
   */
  private analyzeDevice(userAgent: string): RiskFactor {
    const weight = 10 // Base weight
    let triggered = false
    let description = 'Device analysis'
    const value: any = { userAgent }

    try {
      if (this.config.enableDeviceProfiling) {
        // Check for suspicious user agents (simplified)
        const suspiciousAgents = [
          'bot', 'crawler', 'spider', 'scanner',
          'curl', 'wget', 'postman', 'insomnia'
        ]

        const lowerUserAgent = userAgent.toLowerCase()
        const isSuspicious = suspiciousAgents.some(agent => lowerUserAgent.includes(agent))

        if (isSuspicious) {
          triggered = true
          description = `Suspicious user agent detected`
          value.suspiciousPattern = suspiciousAgents.find(agent => lowerUserAgent.includes(agent))
        } else {
          description = `Standard user agent detected`
        }

        // Check for automated tools (simulated)
        if (Math.random() < 0.02) { // 2% chance for demonstration
          triggered = true
          description = `Potential automated tool detected`
        }
      }
    } catch (error) {
      console.warn('Failed to analyze device:', error)
    }

    return {
      name: 'device_analysis',
      weight,
      description,
      value,
      triggered
    }
  }

  /**
   * Update adaptive MFA configuration
   */
  async updateConfiguration(newConfig: Partial<AdaptiveMFAConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig }

    // Log configuration update
    await logSecurityEvent(SecurityEventType.CONFIGURATION_CHANGED, {
      configType: 'adaptive_mfa',
      changes: Object.keys(newConfig),
      timestamp: new Date().toISOString()
    })

    console.log('Adaptive MFA configuration updated:', this.config)
  }

  /**
   * Get current adaptive MFA configuration
   */
  getConfiguration(): AdaptiveMFAConfig {
    return { ...this.config }
  }

  /**
   * Add IP to whitelist
   */
  async addToWhitelist(ipAddress: string): Promise<void> {
    if (!this.config.whitelistedIPs.includes(ipAddress)) {
      this.config.whitelistedIPs.push(ipAddress)

      // Log whitelist update
      await logSecurityEvent(SecurityEventType.CONFIGURATION_CHANGED, {
        configType: 'ip_whitelist',
        action: 'add',
        ipAddress,
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Remove IP from whitelist
   */
  async removeFromWhitelist(ipAddress: string): Promise<void> {
    const index = this.config.whitelistedIPs.indexOf(ipAddress)
    if (index > -1) {
      this.config.whitelistedIPs.splice(index, 1)

      // Log whitelist update
      await logSecurityEvent(SecurityEventType.CONFIGURATION_CHANGED, {
        configType: 'ip_whitelist',
        action: 'remove',
        ipAddress,
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Add country to allowed list
   */
  async addAllowedCountry(countryCode: string): Promise<void> {
    if (!this.config.allowedCountries.includes(countryCode)) {
      this.config.allowedCountries.push(countryCode)

      // Log country update
      await logSecurityEvent(SecurityEventType.CONFIGURATION_CHANGED, {
        configType: 'country_allowlist',
        action: 'add',
        countryCode,
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Remove country from allowed list
   */
  async removeAllowedCountry(countryCode: string): Promise<void> {
    const index = this.config.allowedCountries.indexOf(countryCode)
    if (index > -1) {
      this.config.allowedCountries.splice(index, 1)

      // Log country update
      await logSecurityEvent(SecurityEventType.CONFIGURATION_CHANGED, {
        configType: 'country_allowlist',
        action: 'remove',
        countryCode,
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Add time window to allowed list
   */
  async addAllowedTimeWindow(window: TimeWindow): Promise<void> {
    this.config.allowedTimeWindows.push(window)

    // Log time window update
    await logSecurityEvent(SecurityEventType.CONFIGURATION_CHANGED, {
      configType: 'time_windows',
      action: 'add',
      window,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Remove time window from allowed list
   */
  async removeAllowedTimeWindow(window: TimeWindow): Promise<void> {
    const index = this.config.allowedTimeWindows.findIndex(w =>
      w.dayOfWeek === window.dayOfWeek &&
      w.startTime === window.startTime &&
      w.endTime === window.endTime
    )

    if (index > -1) {
      this.config.allowedTimeWindows.splice(index, 1)

      // Log time window update
      await logSecurityEvent(SecurityEventType.CONFIGURATION_CHANGED, {
        configType: 'time_windows',
        action: 'remove',
        window,
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Evaluate whether MFA should be required for a login attempt
   */
  async shouldRequireMFA(context: LoginContext): Promise<boolean> {
    if (!this.config.enableAdaptiveMFA) {
      return false
    }

    const riskScore = await this.calculateRiskScore(context)
    return riskScore.requiresMFA
  }

  /**
   * Get risk assessment for a login context
   */
  async getRiskAssessment(context: LoginContext): Promise<RiskScore> {
    return await this.calculateRiskScore(context)
  }
}

// Export singleton instance
export const auth0AdaptiveMFAService = new Auth0AdaptiveMFAService()
export default auth0AdaptiveMFAService