import type { CompatibilityIssue } from '@/types/testing.ts'
import { EmailService } from '../email/EmailService'

/* Debug: Validate logger import */
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('compatibility-service')
if (!logger || typeof logger.info !== 'function') {
  // This will show up in the build or runtime logs if the import fails
  // eslint-disable-next-line no-console
  console.error(
    '[CompatibilityService] Logger import failed or is not a valid logger instance',
  )
} else {
  // eslint-disable-next-line no-console
  console.info('[CompatibilityService] Logger import succeeded')
}

export interface BrowserCompatibilityResult {
  browser: string
  passed: boolean
  issues: CompatibilityIssue[]
  timestamp: string
  pageUrl?: string
  deviceType?: 'desktop' | 'mobile' | 'tablet'
}

export interface CompatibilityAlertOptions {
  recipients: string[]
  slackWebhook?: string
  sendEmail: boolean
  sendSlack: boolean
  minSeverity: 'critical' | 'major' | 'minor'
  groupByBrowser: boolean
}

const DEFAULT_OPTIONS: CompatibilityAlertOptions = {
  recipients: [],
  sendEmail: true,
  sendSlack: true,
  minSeverity: 'major',
  groupByBrowser: true,
}

interface SlackBlock {
  type: string
  text?: {
    type: string
    text: string
  }
  elements?: Array<{
    type: string
    text: {
      type: string
      text: string
    }
    url?: string
  }>
}

interface SlackMessage {
  blocks: SlackBlock[]
}

/**
 * Service for tracking and alerting on browser compatibility issues
 */
export class CompatibilityService {
  private emailService: EmailService
  private options: CompatibilityAlertOptions
  private issueRegistry: Map<string, CompatibilityIssue[]> = new Map()
  private static instance: CompatibilityService

  /**
   * Get the singleton instance of CompatibilityService
   */
  public static getInstance(): CompatibilityService {
    if (!CompatibilityService.instance) {
      CompatibilityService.instance = new CompatibilityService()
    }
    return CompatibilityService.instance
  }

  private constructor() {
    this.emailService = new EmailService()
    this.options = { ...DEFAULT_OPTIONS }
  }

  /**
   * Configure the compatibility service
   */
  public configure(options: Partial<CompatibilityAlertOptions>): void {
    this.options = { ...this.options, ...options }
  }

  /**
   * Register a new compatibility issue
   */
  public async registerIssue(issue: CompatibilityIssue): Promise<void> {
    // Generate unique ID if not provided
    if (!issue.id) {
      issue.id = Date.now()
    }

    // Add timestamp if not provided
    if (!issue.timestamp) {
      issue.timestamp = new Date().toISOString()
    }

    // Add to registry
    const { browser } = issue
    if (!this.issueRegistry.has(browser)) {
      this.issueRegistry.set(browser, [])
    }
    this.issueRegistry.get(browser)?.push(issue)

    // Log the issue
    logger.warn(
      `Compatibility issue detected in ${browser}: ${issue.description}`,
    )

    // Determine if alert should be sent based on severity
    if (this.shouldSendAlert(issue.severity)) {
      await this.sendAlert([issue])
    }
  }

  /**
   * Register multiple compatibility issues at once
   */
  public async registerIssues(issues: CompatibilityIssue[]): Promise<void> {
    // Filter issues by severity
    const filteredIssues = issues.filter((issue) =>
      this.shouldSendAlert(issue.severity),
    )

    // Add all issues to registry
    for (const issue of issues) {
      await this.registerIssue(issue)
    }

    // Send alert for filtered issues if any exist
    if (filteredIssues.length > 0) {
      await this.sendAlert(filteredIssues)
    }
  }

  /**
   * Register browser compatibility test results
   */
  public async registerTestResults(
    results: BrowserCompatibilityResult[],
  ): Promise<void> {
    const allIssues: CompatibilityIssue[] = []

    // Extract issues from results
    for (const result of results) {
      if (!result.passed && result.issues.length > 0) {
        allIssues.push(...result.issues)
      }
    }

    // Register all issues
    if (allIssues.length > 0) {
      await this.registerIssues(allIssues)
    }
  }

  /**
   * Get all registered issues
   */
  public getAllIssues(): CompatibilityIssue[] {
    const allIssues: CompatibilityIssue[] = []
    for (const issues of this.issueRegistry.values()) {
      allIssues.push(...issues)
    }
    return allIssues
  }

  /**
   * Get issues by browser
   */
  public getIssuesByBrowser(browser: string): CompatibilityIssue[] {
    return this.issueRegistry.get(browser) || []
  }

  /**
   * Clear all issues
   */
  public clearIssues() {
    this.issueRegistry.clear()
  }

  /**
   * Send alerts for compatibility issues
   */
  private async sendAlert(issues: CompatibilityIssue[]): Promise<void> {
    try {
      if (this.options.sendEmail && this.options.recipients.length > 0) {
        await this.sendEmailAlert(issues)
      }

      if (this.options.sendSlack && this.options.slackWebhook) {
        await this.sendSlackAlert(issues)
      }
    } catch (error: unknown) {
      logger.error('Failed to send compatibility alert', error)
    }
  }

  /**
   * Send email alert for compatibility issues
   */
  private async sendEmailAlert(issues: CompatibilityIssue[]): Promise<void> {
    // Group issues by browser if configured
    const issuesByBrowser = new Map<string, CompatibilityIssue[]>()
    for (const issue of issues) {
      if (!issuesByBrowser.has(issue.browser)) {
        issuesByBrowser.set(issue.browser, [])
      }
      issuesByBrowser.get(issue.browser)?.push(issue)
    }

    // Prepare template data
    const templateData = {
      name: 'Team',
      issueCount: issues.length,
      projectName: process.env['PROJECT_NAME'] || 'Pixelated Empathy',
      branchName: process.env['BRANCH_NAME'] || 'main',
      commitSha: process.env['COMMIT_SHA'] || '',
      detectionTime: new Date().toISOString(),
      workflowUrl: process.env['WORKFLOW_URL'] || '',
      dashboardUrl: process.env['DASHBOARD_URL'] || '',
      browserIssues: Array.from(issuesByBrowser.entries()).map(
        ([browser, browserIssues]) => ({
          browser,
          count: browserIssues.length,
        }),
      ),
      issues: issues.map((issue) => ({
        severity: issue.severity,
        description: issue.description,
        browser: issue.browser,
        component: issue.component,
      })),
    }

    // Send email to all recipients
    const emailPromises = this.options.recipients.map((recipient) =>
      this.emailService.queueEmail({
        to: recipient,
        templateAlias: 'browser-compatibility-alert',
        templateModel: templateData,
      }),
    )

    await Promise.all(emailPromises)
  }

  /**
   * Send Slack alert for compatibility issues
   */
  private async sendSlackAlert(issues: CompatibilityIssue[]): Promise<void> {
    // Group issues by severity
    const criticalIssues = issues.filter((i) => i.severity === 'critical')
    const majorIssues = issues.filter((i) => i.severity === 'major')
    const minorIssues = issues.filter((i) => i.severity === 'minor')

    // Create Slack message
    const slackMessage: SlackMessage = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🚨 Browser Compatibility Alert: ${issues.length} Issues`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${criticalIssues.length}* critical, *${majorIssues.length}* major, and *${minorIssues.length}* minor issues detected.`,
          },
        },
        {
          type: 'divider',
        },
      ],
    }

    // Add up to 5 most critical issues to the message
    const topIssues = [...criticalIssues, ...majorIssues].slice(0, 5)

    if (topIssues.length > 0) {
      slackMessage.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Top Issues:*',
        },
      })

      for (const issue of topIssues) {
        slackMessage.blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `• *${issue.browser}* - ${issue.component}: ${issue.description}`,
          },
        })
      }
    }

    // Add button to view more details
    if (process.env['DASHBOARD_URL']) {
      slackMessage.blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Dashboard',
            },
            url: process.env['DASHBOARD_URL'],
          },
        ],
      })
    }

    // Send Slack message
    if (this.options.slackWebhook) {
      await fetch(this.options.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackMessage),
      })
    }
  }

  /**
   * Determine if an alert should be sent based on severity
   */
  private shouldSendAlert(severity: string): boolean {
    const severityLevels = {
      critical: 3,
      major: 2,
      minor: 1,
    }

    const issueSeverity =
      severityLevels[severity as keyof typeof severityLevels] || 0
    const minSeverity = severityLevels[this.options.minSeverity] || 0

    return issueSeverity >= minSeverity
  }
}
