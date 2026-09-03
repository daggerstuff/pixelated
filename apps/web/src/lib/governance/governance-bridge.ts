import { getLogger } from '../logging'
import { ComplianceValidator } from './compliance-validator'
import { SlackAlerter } from './slack-alert'
import { UnifiedMonitor, type MonitorEvent } from './unified-monitor'

const logger = getLogger('governance-bridge')

/**
 * GovernanceBridge — composition root for governance event aggregation.
 *
 * Routes events from FHE, audit, and secrets subsystems into the UnifiedMonitor.
 * Alert handlers (e.g. Slack) are wired externally via configureSlackWebhook.
 * This is the sole entry point for governance-aware operations throughout the app.
 */
export class GovernanceBridge {
  private static instance: GovernanceBridge
  private readonly monitor: UnifiedMonitor

  private constructor() {
    this.monitor = new UnifiedMonitor()
  }

  static getInstance(): GovernanceBridge {
    if (!GovernanceBridge.instance) {
      GovernanceBridge.instance = new GovernanceBridge()
    }
    return GovernanceBridge.instance
  }

  /** Reset singleton (test cleanup). */
  static reset(): void {
    GovernanceBridge.instance = undefined as unknown as GovernanceBridge
  }

  /** Expose the underlying monitor for inspection / test assertions. */
  getMonitor(): UnifiedMonitor {
    return this.monitor
  }

  /** Create a ComplianceValidator wired to this bridge's monitor. */
  createValidator(): ComplianceValidator {
    return new ComplianceValidator(this.monitor)
  }

  /** Wire Slack alerts. Called once at app startup if SLACK_WEBHOOK_URL is set. */
  configureSlackWebhook(url: string): void {
    const alerter = new SlackAlerter(url)
    this.monitor.onAlert(async (alert) => {
      await alerter.send({
        text: `🚨 Governance Alert: ${alert.type} (count: ${alert.count}, source: ${alert.source})`,
      })
    })
    logger.info('Slack alerting configured')
  }

  /** Low-level record — delegates to UnifiedMonitor.record(). */
  async record(event: MonitorEvent): Promise<void> {
    await this.monitor.record(event)
  }

  // ── FHE integration ──────────────────────────────────────────────

  async recordFHEEncryption(details?: Record<string, unknown>): Promise<void> {
    await this.record({
      source: 'fhe',
      event: 'encryption_complete',
      timestamp: new Date().toISOString(),
      details,
    })
  }

  async recordFHEDecryption(details?: Record<string, unknown>): Promise<void> {
    await this.record({
      source: 'fhe',
      event: 'decryption_complete',
      timestamp: new Date().toISOString(),
      details,
    })
  }

  // ── Audit integration ───────────────────────────────────────────

  async recordAuditEvent(details?: Record<string, unknown>): Promise<void> {
    await this.record({
      source: 'audit',
      event: 'audit_event',
      timestamp: new Date().toISOString(),
      details,
    })
  }

  // ── Secrets integration ──────────────────────────────────────────

  async recordSecretAccess(key: string): Promise<void> {
    await this.record({
      source: 'secrets',
      event: 'secret_access',
      timestamp: new Date().toISOString(),
      details: { key },
    })
  }

  async recordSecretRotation(key: string): Promise<void> {
    await this.record({
      source: 'secrets',
      event: 'secret_rotation',
      timestamp: new Date().toISOString(),
      details: { key },
    })
  }

  // ── Compliance integration ───────────────────────────────────────

  async recordComplianceDecision(
    operation: string,
    compliant: boolean,
    reasons: string[],
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.record({
      source: 'governance',
      event: compliant ? 'compliance_allow' : 'compliance_failure',
      timestamp: new Date().toISOString(),
      details: { ...details, operation, reasons },
    })
  }
}
