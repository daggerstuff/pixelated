/**
 * Complete threat detection system factory.
 * Classes extracted to dedicated modules; factory wires them together.
 */

import { ProductionThreatDetectionService } from './production-threat-detection-service'
import { ProductionMonitoringService } from './production-monitoring-service'
import { ProductionHuntingService } from './production-hunting-service'
import { ProductionIntelligenceService } from './production-intelligence-service'

import { createBuildSafeLogger } from '../../../logger'

const logger = createBuildSafeLogger('threat-detection-system')

export function createCompleteThreatDetectionSystem(
  orchestrator: unknown,
  rateLimiter: unknown,
  options?: {
    threatDetection?: Record<string, unknown>
    monitoring?: Record<string, unknown>
    hunting?: Record<string, unknown>
    intelligence?: Record<string, unknown>
  },
) {
  // Create production services
  const threatDetectionService = new ProductionThreatDetectionService(
    options?.threatDetection,
  )
  const monitoringService = new ProductionMonitoringService(options?.monitoring)
  const huntingService = new ProductionHuntingService(options?.hunting)
  const intelligenceService = new ProductionIntelligenceService(
    options?.intelligence,
  )

  // Wire events immediately
  const system = {
    threatDetectionService,
    monitoringService,
    huntingService,
    intelligenceService,

    // Wire orchestrator events to services
    _wireEvents() {
      // Security events → monitoring
      const orch = orchestrator as Record<string, unknown>
      if (orchestrator && typeof orch['on'] === 'function') {
        orch['on']('security:event', (event: Record<string, unknown>) => {
          void monitoringService.recordMetric({
            name: (event['type'] as string) ?? 'security_event',
            value: !(event['success'] as boolean) ? 1 : 0,
            timestamp: new Date((event['timestamp'] as number) ?? Date.now()),
            tags: {
              userId: (event['userId'] as string) ?? '',
              ip: (event['ip'] as string) ?? '',
            },
          })
        })

        // Threat detected → hunting
        orch['on'](
          'threat:detected',
          async (threat: Record<string, unknown>) => {
            void monitoringService.recordMetric({
              name: 'threats_detected',
              value: 1,
              timestamp: new Date(
                (threat['timestamp'] as number) ?? Date.now(),
              ),
              tags: {
                severity: (threat['severity'] as string) ?? '',
                threatId: (threat['threatId'] as string) ?? '',
              },
            })

            if (
              (threat['severity'] as string) === 'high' ||
              (threat['severity'] as string) === 'critical'
            ) {
              void huntingService.startInvestigation({
                threatId: (threat['threatId'] as string) ?? '',
                userId: (threat['userId'] as string) ?? '',
                severity: (threat['severity'] as string) ?? 'medium',
                description: `Auto-investigation for ${(threat['type'] as string) ?? 'threat'}`,
              })
            }
          },
        )
      }

      // Service audit logs → orchestrator
      monitoringService.on('audit:log', (log: Record<string, unknown>) => {
        if (orchestrator && typeof orch['emit'] === 'function') {
          orch['emit']('audit:log', log)
        }
      })

      huntingService.on('audit:log', (log: Record<string, unknown>) => {
        if (orchestrator && typeof orch['emit'] === 'function') {
          orch['emit']('audit:log', log)
        }
      })
    },

    // Unified interface
    async processRequest(request: unknown) {
      try {
        const threatResult = await threatDetectionService.processRequest(
          request as Record<string, unknown>,
        )
        const insights = await monitoringService.generateInsights()

        // Trigger hunting for high-risk requests
        if ((threatResult['riskScore'] as number) > 0.7) {
          await huntingService.triggerHunt({
            type: 'high-risk-request',
            context: request,
            priority: 'high',
          })
        }

        return {
          success: true,
          threat: threatResult,
          insights,
          timestamp: new Date(),
        }
      } catch (error: unknown) {
        logger.error('Request processing failed:', { error })
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        }
      }
    },

    async getSystemHealth() {
      const [
        threatHealth,
        monitoringHealth,
        huntingHealth,
        intelligenceHealth,
      ] = await Promise.all([
        threatDetectionService.getHealthStatus(),
        monitoringService.getHealthStatus(),
        huntingService.getHealthStatus(),
        intelligenceService.getHealthStatus(),
      ])

      const th = threatHealth
      const mh = monitoringHealth
      const hh = huntingHealth
      const ih = intelligenceHealth

      return {
        healthy:
          (th['healthy'] as boolean) &&
          (mh['healthy'] as boolean) &&
          (hh['healthy'] as boolean) &&
          (ih['healthy'] as boolean),
        services: {
          threatDetection: th['healthy'] as boolean,
          monitoring: mh['healthy'] as boolean,
          hunting: hh['healthy'] as boolean,
          intelligence: ih['healthy'] as boolean,
        },
        details: {
          threatDetection: th,
          monitoring: mh,
          hunting: hh,
          intelligence: ih,
        },
        timestamp: new Date(),
      }
    },

    async getSystemStatistics() {
      const [threatStats, monitoringStats, huntingStats, intelligenceStats] =
        await Promise.all([
          threatDetectionService.getStatistics(),
          monitoringService.getStatistics(),
          huntingService.getStatistics(),
          intelligenceService.getStatistics(),
        ])

      const ts = threatStats
      const ms = monitoringStats
      const hs = huntingStats
      const isc = intelligenceStats

      return {
        threats: {
          total: ts['totalThreats'] as number,
          blocked: ts['blockedRequests'] as number,
          averageResponseTime: (ts['averageResponseTime'] as number) ?? 0,
          distribution:
            (ts['threatDistribution'] as Record<string, number>) ?? {},
        },
        monitoring: {
          insights: ms['totalInsights'] as number,
          alerts: ms['totalAlerts'] as number,
          anomalies: ms['anomaliesDetected'] as number,
        },
        hunting: {
          hunts: hs['totalHunts'] as number,
          findings: hs['totalFindings'] as number,
          investigations: hs['activeInvestigations'] as number,
        },
        intelligence: {
          indicators: isc['totalIndicators'] as number,
          feeds: isc['activeFeedCount'] as number,
          lastUpdate: isc['lastUpdateTime'] as Date,
        },
        timestamp: new Date(),
      }
    },
  }

  system._wireEvents()

  return system
}
