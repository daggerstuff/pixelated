import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { redis } from '@/lib/redis'
import { fheService } from '@/lib/fhe'

export interface TrainingMaterials {
  procedures: {
    title: string
    content: string
    lastUpdated: number
  }
  guidelines: {
    title: string
    content: string
    lastUpdated: number
  }
  templates: {
    title: string
    content: string
    lastUpdated: number
  }
}

/**
 * Local helper to get user by ID.
 * Replace with real implementation as needed.
 */
async function getUserById(
  userId: string,
): Promise<{ id: string; email: string; name: string }> {
  // Mock implementation that returns definite string values
  return {
    id: userId,
    email: `user-${userId}@example.com`,
    name: `User ${userId}`,
  }
}

export interface BreachDetails {
  id: string
  timestamp: number
  type: 'unauthorized_access' | 'data_leak' | 'system_compromise' | 'other'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  affectedUsers: string[]
  affectedData: string[]
  detectionMethod: string
  remediation: string
  notificationStatus: 'pending' | 'in_progress' | 'completed'
}

interface NotificationTemplate {
  subject: string
  textContent: string
}

// Implement proper mock for HHS_NOTIFICATION_EMAIL
// Make sure process.env values are handled safely
const ENV = {
  ORGANIZATION_NAME:
    process.env['ORGANIZATION_NAME'] || 'Pixelated Empathy Health',
  SECURITY_CONTACT: process.env['SECURITY_CONTACT'] || 'security@example.com',
  ORGANIZATION_ADDRESS:
    process.env['ORGANIZATION_ADDRESS'] || '123 Health St, MedCity',
  HHS_NOTIFICATION_EMAIL:
    process.env['HHS_NOTIFICATION_EMAIL'] || 'hhs-notifications@example.gov',
  SECURITY_STAKEHOLDERS: (
    process.env['SECURITY_STAKEHOLDERS'] || 'admin@example.com'
  ).split(','),
}

// Constants
const BREACH_KEY_PREFIX = 'breach:'
const DOCUMENTATION_RETENTION = 60 * 60 * 24 * 365 * 6 // 6 years in seconds
const METRICS_KEY_PREFIX = 'metrics:breach:'
const TRAINING_KEY_PREFIX = 'training:breach:'

function getBreachKey(id: string): string {
  return `${BREACH_KEY_PREFIX}${id}`
}

export async function reportBreach(
  details: Omit<BreachDetails, 'id' | 'timestamp' | 'notificationStatus'>,
): Promise<string> {
  try {
    // Use crypto.randomUUID when available, otherwise use secure random bytes
    const cryptoLib = await import('crypto')
    const uuidPart =
      typeof cryptoLib.randomUUID === 'function'
        ? cryptoLib.randomUUID()
        : cryptoLib.randomBytes(8).toString('hex')
    const id = `breach_${Date.now()}_${uuidPart}`
    const breach: BreachDetails = {
      ...details,
      id,
      timestamp: Date.now(),
      notificationStatus: 'pending',
    }

    // Store breach details
    await redis.set(
      getBreachKey(id),
      JSON.stringify(breach),
      'EX',
      60 * 60 * 24 * 30, // 30 days retention
    )

    // Log the breach
    logger.error('Security breach detected:', {
      id,
      type: breach.type,
      severity: breach.severity,
      description: breach.description,
      affectedUsers: breach.affectedUsers.length,
    })

    // Start notification process
    await initiateNotificationProcess(breach)

    return id
  } catch (error: unknown) {
    logger.error('Failed to report breach:', error)
    throw error
  }
}

async function initiateNotificationProcess(
  breach: BreachDetails,
): Promise<void> {
  try {
    // Update status
    const updatedBreach = { ...breach, notificationStatus: 'in_progress' }
    await redis.set(getBreachKey(breach.id), JSON.stringify(updatedBreach))

    // Prepare notifications
    const template = getNotificationTemplate(breach)

    // Notify affected users
    await notifyAffectedUsers(breach, template)

    // Notify authorities if required by HIPAA
    if (requiresAuthorityNotification(breach)) {
      await notifyAuthorities(breach)
    }

    // Notify internal stakeholders
    await notifyInternalStakeholders(breach)

    // Update status to completed
    const completedBreach = {
      ...updatedBreach,
      notificationStatus: 'completed',
    }
    await redis.set(getBreachKey(breach.id), JSON.stringify(completedBreach))
  } catch (error: unknown) {
    logger.error('Failed to process breach notifications:', error)
    throw error
  }
}

function getNotificationTemplate(breach: BreachDetails): NotificationTemplate {
  return {
    subject: `Important Security Notice - ${breach.severity.toUpperCase()} Security Event`,
    textContent: `
Dear [User],

We are writing to inform you about a security incident that may have affected your account.

Incident Details:
- Type: ${breach.type}
- Date Detected: ${new Date(breach.timestamp).toLocaleDateString()}
- Affected Information: ${breach.affectedData.join(', ')}

Actions Taken:
${breach.remediation}

Steps You Should Take:
1. Change your password immediately
2. Review your account activity
3. Enable two-factor authentication if not already enabled
4. Monitor your accounts for suspicious activity

We take your privacy and security seriously and are working diligently to prevent such incidents in the future.

If you notice any suspicious activity or have questions, please contact our support team immediately.

Best regards,
Security Team
    `.trim(),
  }
}

async function notifyAffectedUsers(
  breach: BreachDetails,
  template: NotificationTemplate,
): Promise<void> {
  const notifications = breach.affectedUsers.map(async (userId) => {
    try {
      const user = await getUserById(userId)

      if (!user || !user.email) {
        logger.warn(`User ${userId} has no email, skipping notification`)
        return
      }

      // Encrypt notification details using FHE (not used in this context)
      await fheService.encrypt(
        JSON.stringify({
          breachId: breach.id,
          timestamp: breach.timestamp,
          type: breach.type,
        }),
      )

      await sendEmail({
        to: user.email,
        subject: template.subject,
        textContent: template.textContent.replace(
          '[User]',
          user.name || 'Valued User',
        ),
      })
    } catch (error: unknown) {
      logger.error('Failed to notify user:', {
        userId,
        breachId: breach.id,
        error,
      })
    }
  })

  await Promise.all(notifications)
}

function requiresAuthorityNotification(breach: BreachDetails): boolean {
  // HIPAA requires notification for breaches affecting 500 or more individuals
  return breach.affectedUsers.length >= 500 || breach.severity === 'critical'
}

async function notifyAuthorities(breach: BreachDetails): Promise<void> {
  try {
    // Prepare HIPAA-compliant notification
    const notification = {
      breachId: breach.id,
      organizationInfo: {
        name: ENV.ORGANIZATION_NAME,
        contact: ENV.SECURITY_CONTACT,
        address: ENV.ORGANIZATION_ADDRESS,
      },
      breach: {
        type: breach.type,
        discoveryDate: new Date(breach.timestamp).toISOString(),
        description: breach.description,
        affectedIndividuals: breach.affectedUsers.length,
        affectedData: breach.affectedData,
        remediation: breach.remediation,
      },
    }

    // Send to HHS (Health and Human Services)
    await sendEmail({
      to: ENV.HHS_NOTIFICATION_EMAIL,
      subject: `HIPAA Breach Notification - ${breach.id}`,
      textContent: JSON.stringify(notification, null, 2),
    })

    // Log the notification
    logger.info('Authority notification sent:', {
      breachId: breach.id,
      timestamp: Date.now(),
    })
  } catch (error: unknown) {
    logger.error('Failed to notify authorities:', error)
    throw error
  }
}

async function notifyInternalStakeholders(
  breach: BreachDetails,
): Promise<void> {
  try {
    const notifications = ENV.SECURITY_STAKEHOLDERS.map((email) =>
      sendEmail({
        to: email,
        subject: `Security Breach Alert - ${breach.severity.toUpperCase()} - ${breach.id}`,
        textContent: `
Security Breach Details:
- ID: ${breach.id}
- Type: ${breach.type}
- Severity: ${breach.severity}
- Description: ${breach.description}
- Affected Users: ${breach.affectedUsers.length}
- Affected Data: ${breach.affectedData.join(', ')}
- Detection Method: ${breach.detectionMethod}
- Remediation: ${breach.remediation}

Timeline:
- Detected: ${new Date(breach.timestamp).toISOString()}
- Notification Status: ${breach.notificationStatus}

Please review the incident and take necessary actions.
        `.trim(),
      }),
    )

    await Promise.all(notifications)
  } catch (error: unknown) {
    logger.error('Failed to notify internal stakeholders:', error)
    throw error
  }
}

export async function getBreachStatus(
  id: string,
): Promise<BreachDetails | null> {
  try {
    const breach = await redis.get(getBreachKey(id))
    return breach ? (JSON.parse(breach) as BreachDetails) : null
  } catch (error: unknown) {
    logger.error('Failed to get breach status:', error)
    throw error
  }
}

export async function listRecentBreaches(): Promise<BreachDetails[]> {
  try {
    const keys = await redis.keys(`${BREACH_KEY_PREFIX}*`)
    const breaches = await Promise.all(
      keys.map(async (key: string) => {
        const breach = await redis.get(key)
        return breach ? (JSON.parse(breach) as BreachDetails) : null
      }),
    )

    return breaches
      .filter((item): item is BreachDetails => Boolean(item))
      .sort(
        (a, b) =>
          (b as BreachDetails).timestamp - (a as BreachDetails).timestamp,
      )
  } catch (error: unknown) {
    logger.error('Failed to list recent breaches:', error)
    throw error
  }
}

export async function runTestScenario(scenario: {
  type: BreachDetails['type']
  severity: BreachDetails['severity']
  affectedUsers: number
}): Promise<string> {
  try {
    // Generate test data
    const testUsers = Array.from(
      { length: scenario.affectedUsers },
      (_, i) => `test_user_${i}`,
    )

    const breachDetails = {
      type: scenario.type,
      severity: scenario.severity,
      description: `Test scenario: ${scenario.type} breach with ${scenario.affectedUsers} affected users`,
      affectedUsers: testUsers,
      affectedData: ['test_data'],
      detectionMethod: 'test_scenario',
      remediation: 'Test remediation steps',
    }

    // Run the test scenario
    const breachId = await reportBreach(breachDetails)

    // Log test execution
    await recordTestExecution(breachId, scenario)

    return breachId
  } catch (error: unknown) {
    logger.error('Failed to run test scenario:', error)
    throw error
  }
}

async function recordTestExecution(
  breachId: string,
  scenario: unknown,
): Promise<void> {
  const testRecord = {
    breachId,
    scenario,
    timestamp: Date.now(),
    result: 'completed',
  }

  await redis.set(
    `${BREACH_KEY_PREFIX}test:${breachId}`,
    JSON.stringify(testRecord),
    'EX',
    DOCUMENTATION_RETENTION,
  )
}

export async function updateMetrics(breach: BreachDetails): Promise<void> {
  try {
    const date = new Date(breach.timestamp)
    const monthKey = `${METRICS_KEY_PREFIX}${date.getFullYear()}-${date.getMonth() + 1}`

    const metrics = {
      totalBreaches: 1,
      byType: { [breach.type]: 1 },
      bySeverity: { [breach.severity]: 1 },
      totalAffectedUsers: breach.affectedUsers.length,
      averageNotificationTime: await calculateAverageNotificationTime(breach),
      notificationEffectiveness:
        await calculateNotificationEffectiveness(breach),
    }

    // Update monthly metrics
    await redis.hset(monthKey, {
      ...metrics,
      lastUpdated: Date.now(),
    } as any)

    // Set retention period
    await redis.expire(monthKey, DOCUMENTATION_RETENTION)
  } catch (error: unknown) {
    logger.error('Failed to update metrics:', error)
  }
}

async function calculateAverageNotificationTime(
  breach: BreachDetails,
): Promise<number> {
  const breachData = await getBreachStatus(breach.id)
  if (!breachData || breachData.notificationStatus !== 'completed') {
    return 0
  }

  // Calculate time from detection to completion
  return Date.now() - breach.timestamp
}

async function calculateNotificationEffectiveness(
  breach: BreachDetails,
): Promise<number> {
  const totalNotifications = breach.affectedUsers.length
  const deliveredNotifications = await countDeliveredNotifications()

  return totalNotifications > 0
    ? deliveredNotifications / totalNotifications
    : 0
}

async function countDeliveredNotifications(): Promise<number> {
  // Implementation would track email delivery status
  return 0 // Placeholder
}

export async function getTrainingMaterials(): Promise<TrainingMaterials> {
  try {
    const materials = {
      procedures: {
        title: 'Breach Response Procedures',
        content: await getBreachProcedures(),
        lastUpdated: Date.now(),
      },
      guidelines: {
        title: 'HIPAA Compliance Guidelines',
        content: await getHIPAAGuidelines(),
        lastUpdated: Date.now(),
      },
      templates: {
        title: 'Notification Templates',
        content: await getNotificationTemplates(),
        lastUpdated: Date.now(),
      },
    }

    // Store training materials with retention period
    await redis.set(
      `${TRAINING_KEY_PREFIX}current`,
      JSON.stringify(materials),
      'EX',
      DOCUMENTATION_RETENTION,
    )

    return materials
  } catch (error: unknown) {
    logger.error('Failed to get training materials:', error)
    throw error
  }
}

async function getBreachProcedures(): Promise<string> {
  return `
1. Immediate Response
   - Assess breach severity and scope
   - Identify affected users and data
   - Document initial findings

2. Notification Process
   - Prepare notifications for affected users
   - Determine if authority notification is required
   - Send notifications within required timeframes

3. Documentation Requirements
   - Record all breach details
   - Maintain notification records
   - Track remediation efforts

4. Follow-up Actions
   - Monitor for additional impacts
   - Update security measures
   - Review and update procedures
  `.trim()
}

async function getHIPAAGuidelines(): Promise<string> {
  return `
HIPAA Breach Notification Requirements:

1. Timing Requirements
   - 60 days for breaches affecting 500+ individuals
   - Annual report for smaller breaches

2. Content Requirements
   - Description of breach
   - Types of information involved
   - Steps individuals should take
   - What the organization is doing
   - Contact information

3. Documentation
   - Maintain records for 6 years
   - Include all notifications sent
   - Record notification methods used
  `.trim()
}

async function getNotificationTemplates(): Promise<string> {
  return `
1. User Notification Template
2. Authority Notification Template
3. Internal Stakeholder Template
4. Media Notification Template (if required)
  `.trim()
}

export const BreachNotificationSystem = {
  reportBreach,
  getBreachStatus,
  listRecentBreaches,
  runTestScenario,
  updateMetrics,
  getTrainingMaterials,
}
