import { createBuildSafeLogger } from './logging/build-safe-logger'

const logger = createBuildSafeLogger({ prefix: 'EmailService' })

export interface EmailConfig {
  provider: 'smtp' | 'sendgrid' | 'aws-ses' | 'resend'
  apiKey?: string
  smtpHost?: string
  smtpPort?: number
  smtpUser?: string
  smtpPassword?: string
  fromEmail: string
  fromName: string
}

export interface EmailMessage {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  htmlContent?: string
  textContent?: string
  attachments?: EmailAttachment[]
}

export interface EmailAttachment {
  filename: string
  content: string | Buffer
  contentType: string
  encoding?: 'base64' | 'binary'
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
  provider: string
}

/**
 * Email Service for sending notifications and communications
 */
export class EmailService {
  private config: EmailConfig

  constructor(config: EmailConfig) {
    this.config = config
    logger.info('EmailService initialized', { provider: config.provider })
  }

  /**
   * Send an email message
   */
  async sendEmail(message: EmailMessage): Promise<EmailResult> {
    try {
      logger.debug('Sending email', {
        to: message.to,
        subject: message.subject,
        provider: this.config.provider,
      })

      // In production, this would integrate with actual email providers
      // For now, we'll simulate sending
      await this.simulateEmailSend(message)

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      logger.info('Email sent successfully', {
        messageId,
        to: message.to,
        provider: this.config.provider,
      })

      return {
        success: true,
        messageId,
        provider: this.config.provider,
      }
    } catch (error: unknown) {
      logger.error('Failed to send email', {
        error,
        to: message.to,
        subject: message.subject,
      })

      return {
        success: false,
        error: `Email send failed: ${error}`,
        provider: this.config.provider,
      }
    }
  }

  /**
   * Send a security breach notification
   */
  async sendBreachNotification(
    recipients: string[],
    breachDetails: {
      type: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      affectedUsers: number
      detectedAt: Date
      description: string
    },
  ): Promise<EmailResult> {
    const subject = `SECURITY ALERT: ${breachDetails.type} Detected`

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #dc3545; color: white; padding: 20px; text-align: center;">
          <h1>🚨 Security Breach Alert</h1>
        </div>
        
        <div style="padding: 20px;">
          <h2>Breach Details</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Type:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${breachDetails.type}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Severity:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">
                <span style="color: ${this.getSeverityColor(breachDetails.severity)}; font-weight: bold;">
                  ${breachDetails.severity.toUpperCase()}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Affected Users:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${breachDetails.affectedUsers}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Detected At:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${breachDetails.detectedAt.toISOString()}</td>
            </tr>
          </table>
          
          <h3>Description</h3>
          <p>${breachDetails.description}</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0;">
            <p><strong>Immediate Actions Required:</strong></p>
            <ul>
              <li>Review security logs and incident details</li>
              <li>Assess impact on affected users</li>
              <li>Implement containment measures</li>
              <li>Prepare user notifications if required</li>
            </ul>
          </div>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-top: 1px solid #ddd;">
          <p style="margin: 0; color: #6c757d; font-size: 12px;">
            This is an automated security alert from Pixelated Mental Health Platform
          </p>
        </div>
      </div>
    `

    return this.sendEmail({
      to: recipients,
      subject,
      htmlContent,
      textContent: this.stripHtml(htmlContent),
    })
  }

  /**
   * Send a patient deletion confirmation email
   */
  async sendPatientDeletionConfirmation(
    patientEmail: string,
    deletionDetails: {
      requestId: string
      scheduledDate: Date
      dataTypes: string[]
    },
  ): Promise<EmailResult> {
    const subject = 'Data Deletion Request Confirmation'

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #007bff; color: white; padding: 20px; text-align: center;">
          <h1>Data Deletion Request Confirmed</h1>
        </div>
        
        <div style="padding: 20px;">
          <p>Dear Patient,</p>
          
          <p>We have received and confirmed your request to delete your personal data from our system.</p>
          
          <h3>Deletion Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Request ID:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${deletionDetails.requestId}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Scheduled Date:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${deletionDetails.scheduledDate.toLocaleDateString()}</td>
            </tr>
          </table>
          
          <h3>Data Types to be Deleted</h3>
          <ul>
            ${deletionDetails.dataTypes.map((type) => `<li>${type}</li>`).join('')}
          </ul>
          
          <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <p><strong>Important:</strong> Once your data is deleted, it cannot be recovered. Please ensure you have downloaded any information you may need before the scheduled deletion date.</p>
          </div>
          
          <p>If you have any questions or need to modify this request, please contact our support team immediately.</p>
          
          <p>Best regards,<br>Pixelated Mental Health Platform Team</p>
        </div>
      </div>
    `

    return this.sendEmail({
      to: patientEmail,
      subject,
      htmlContent,
      textContent: this.stripHtml(htmlContent),
    })
  }

  private async simulateEmailSend(message: EmailMessage): Promise<void> {
    // Simulate network delay
    await new Promise((resolve) =>
      setTimeout(resolve, 100 + Math.random() * 200),
    )

    // Log the message being sent (in dev mode)
    logger.debug('Simulating email send', {
      to: message.to,
      subject: message.subject,
    })

    // Simulate occasional failures (5% failure rate)
    if (Math.random() < 0.05) {
      throw new Error('Simulated email provider error')
    }
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical':
        return '#dc3545'
      case 'high':
        return '#fd7e14'
      case 'medium':
        return '#ffc107'
      case 'low':
        return '#28a745'
      default:
        return '#6c757d'
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim()
  }

  /**
   * Upsert an email template
   */
  async upsertTemplate(template: {
    alias: string
    subject: string
    htmlBody: string
    from: string
  }): Promise<void> {
    // In a real implementation, this would store the template in a database
    // For now, we'll just log it
    logger.info('Email template upserted', { alias: template.alias })
  }

  /**
   * Queue an email for sending
   */
  async queueEmail(email: {
    to: string
    templateAlias: string
    templateModel: Record<string, unknown>
  }): Promise<void> {
    // In a real implementation, this would queue the email for processing
    // For now, we'll simulate sending it immediately
    logger.info('Email queued', {
      to: email.to,
      templateAlias: email.templateAlias,
    })

    // Simulate immediate sending
    await this.sendEmail({
      to: email.to,
      subject: `Template: ${email.templateAlias}`,
      htmlContent: `<p>Template: ${email.templateAlias}</p><pre>${JSON.stringify(email.templateModel, null, 2)}</pre>`,
      textContent: `Template: ${email.templateAlias}\n${JSON.stringify(email.templateModel, null, 2)}`,
    })
  }

  async startProcessing(interval: number): Promise<void> {
    logger.info('Email processing started', { interval })
    // In a real implementation, this would start a loop to process the email queue
  }
}

// Default email service instance
let emailServiceInstance: EmailService | null = null

/**
 * Get the default email service instance
 */
export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    const config: EmailConfig = {
      provider: 'smtp',
      fromEmail: process.env['FROM_EMAIL'] || 'noreply@pixelated.health',
      fromName: process.env['FROM_NAME'] || 'Pixelated Mental Health Platform',
      smtpHost: process.env['SMTP_HOST'],
      smtpPort: Number.parseInt(process.env['SMTP_PORT'] || '587'),
      smtpUser: process.env['SMTP_USER'],
      smtpPassword: process.env['SMTP_PASSWORD'],
      apiKey: process.env['EMAIL_API_KEY'],
    }

    emailServiceInstance = new EmailService(config)
  }

  return emailServiceInstance
}

/**
 * Send a breach notification email
 */
export async function sendBreachNotification(
  recipients: string[],
  breachDetails: Parameters<EmailService['sendBreachNotification']>[1],
): Promise<EmailResult> {
  const emailService = getEmailService()
  return emailService.sendBreachNotification(recipients, breachDetails)
}

/**
 * Send patient deletion confirmation
 */
export async function sendPatientDeletionConfirmation(
  patientEmail: string,
  deletionDetails: Parameters<
    EmailService['sendPatientDeletionConfirmation']
  >[1],
): Promise<EmailResult> {
  const emailService = getEmailService()
  return emailService.sendPatientDeletionConfirmation(
    patientEmail,
    deletionDetails,
  )
}

/**
 * Send a generic email using the default email service
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const emailService = getEmailService()
  return emailService.sendEmail(message)
}
