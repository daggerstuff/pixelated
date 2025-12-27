import nodemailer from 'nodemailer'
import { productionConfig } from '../config/production.js'

export interface EmailTemplate {
  subject: string
  html: string
  text?: string
}

export interface BusinessAlertEmail {
  userEmail: string
  alerts: Array<{
    title: string
    description: string
    severity: string
    timestamp: Date
  }>
}

export interface WeeklyDigest {
  userEmail: string
  userName: string
  metrics: {
    newOpportunities: number
    marketChanges: number
    competitorUpdates: number
  }
  topAlerts: Array<{
    title: string
    severity: string
  }>
}

export class EmailService {
  private transporter: nodemailer.Transporter

  constructor() {
    this.transporter = this.createTransporter()
  }

  private createTransporter(): nodemailer.Transporter {
    const config = productionConfig.email

    switch (config.provider) {
      case 'sendgrid':
        return nodemailer.createTransporter({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: config.sendgrid.apiKey,
          },
        })

      case 'smtp':
        return nodemailer.createTransporter({
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.secure,
          auth: config.smtp.auth,
        })

      case 'aws':
        return nodemailer.createTransporter({
          host: 'email-smtp.us-east-1.amazonaws.com',
          port: 587,
          secure: false,
          auth: {
            user: process.env.AWS_SES_USER || '',
            pass: process.env.AWS_SES_PASS || '',
          },
        })

      default:
        return nodemailer.createTransporter({
          service: 'gmail',
          auth: {
            user: productionConfig.email.smtp.auth.user,
            pass: productionConfig.email.smtp.auth.pass,
          },
        })
    }
  }

  async sendBusinessAlert(emailData: BusinessAlertEmail): Promise<void> {
    const template = this.generateBusinessAlertTemplate(emailData)

    await this.transporter.sendMail({
      from: productionConfig.email.fromEmail,
      to: emailData.userEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
  }

  async sendWeeklyDigest(digest: WeeklyDigest): Promise<void> {
    const template = this.generateWeeklyDigestTemplate(digest)

    await this.transporter.sendMail({
      from: productionConfig.email.fromEmail,
      to: digest.userEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
  }

  async sendWelcomeEmail(email: string, userName: string): Promise<void> {
    const template = this.generateWelcomeTemplate(userName)

    await this.transporter.sendMail({
      from: productionConfig.email.fromEmail,
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
  ): Promise<void> {
    const template = this.generatePasswordResetTemplate(resetToken)

    await this.transporter.sendMail({
      from: productionConfig.email.fromEmail,
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
  }

  async sendDocumentSharedEmail(
    email: string,
    documentName: string,
    sharedBy: string,
    accessUrl: string,
  ): Promise<void> {
    const template = this.generateDocumentSharedTemplate(
      documentName,
      sharedBy,
      accessUrl,
    )

    await this.transporter.sendMail({
      from: productionConfig.email.fromEmail,
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
  }

  async sendCollaborationInvite(
    email: string,
    documentName: string,
    invitedBy: string,
    accessUrl: string,
  ): Promise<void> {
    const template = this.generateCollaborationInviteTemplate(
      documentName,
      invitedBy,
      accessUrl,
    )

    await this.transporter.sendMail({
      from: productionConfig.email.fromEmail,
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
  }

  private generateBusinessAlertTemplate(
    data: BusinessAlertEmail,
  ): EmailTemplate {
    const alertCount = data.alerts.length
    const subject = `🚨 ${alertCount} New Business Alert${alertCount > 1 ? 's' : ''}`

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Business Alerts</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
          .header { background: #2563eb; color: white; padding: 20px; }
          .alert { padding: 15px; margin: 10px 0; border-left: 4px solid #ef4444; background: #fef2f2; }
          .alert.medium { border-left-color: #f59e0b; background: #fffbeb; }
          .alert.low { border-left-color: #10b981; background: #f0fdf4; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Business Strategy CMS</h1>
            <p>New business alerts</p>
          </div>
          
          <div style="padding: 20px;">
            <h2>${subject}</h2>
            
            ${data.alerts
              .map(
                (alert) => `
              <div class="alert ${alert.severity}">
                <strong>${alert.title}</strong>
                <p>${alert.description}</p>
                <small>${alert.timestamp.toLocaleString()}</small>
              </div>
            `,
              )
              .join('')}
          </div>
          
          <div class="footer">
            <p>Pixelated Business Strategy CMS</p>
            <p>Manage your business intelligence at <a href="https://pixelated.com">pixelated.com</a></p>
          </div>
        </div>
      </body>
      </html>
    `

    const text = `
      Business Strategy CMS - ${alertCount} New Alert${alertCount > 1 ? 's' : ''}
      
      ${data.alerts
        .map(
          (alert) => `
        ${alert.title}
        ${alert.description}
        ${alert.timestamp.toLocaleString()}
      `,
        )
        .join('\n\n')}
    `

    return { subject, html, text }
  }

  private generateWeeklyDigestTemplate(digest: WeeklyDigest): EmailTemplate {
    const subject = `📊 Weekly Business Intelligence Digest - ${new Date().toLocaleDateString()}`

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Weekly Digest</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
          .header { background: #2563eb; color: white; padding: 20px; }
          .metric { padding: 15px; margin: 10px 0; background: #f8fafc; border-radius: 4px; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Weekly Business Intelligence Digest</h1>
            <p>Hello ${digest.userName},</p>
          </div>
          
          <div style="padding: 20px;">
            <h2>This Week's Summary</h2>
            
            <div class="metric">
              <strong>New Opportunities:</strong> ${digest.metrics.newOpportunities}
            </div>
            
            <div class="metric">
              <strong>Market Changes:</strong> ${digest.metrics.marketChanges}
            </div>
            
            <div class="metric">
              <strong>Competitor Updates:</strong> ${digest.metrics.competitorUpdates}
            </div>
            
            <h3>Top Alerts</h3>
            ${digest.topAlerts
              .map(
                (alert) => `
              <p><strong>${alert.title}</strong> (${alert.severity})</p>
            `,
              )
              .join('')}
          </div>
          
          <div class="footer">
            <p>Pixelated Business Strategy CMS</p>
          </div>
        </div>
      </body>
      </html>
    `

    const text = `
      Weekly Business Intelligence Digest
      
      Hello ${digest.userName},
      
      This week's summary:
      - New Opportunities: ${digest.metrics.newOpportunities}
      - Market Changes: ${digest.metrics.marketChanges}
      - Competitor Updates: ${digest.metrics.competitorUpdates}
      
      Top Alerts:
      ${digest.topAlerts.map((alert) => `- ${alert.title} (${alert.severity})`).join('\n')}
    `

    return { subject, html, text }
  }

  private generateWelcomeTemplate(userName: string): EmailTemplate {
    const subject = 'Welcome to Pixelated Business Strategy CMS!'

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
          .header { background: #2563eb; color: white; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Pixelated!</h1>
          </div>
          
          <div style="padding: 20px;">
            <h2>Hello ${userName},</h2>
            <p>Welcome to Pixelated Business Strategy CMS! Your account is now set up and ready to use.</p>
            
            <h3>Get Started</h3>
            <ul>
              <li>Upload business documents</li>
              <li>Collaborate in real-time</li>
              <li>Track market intelligence</li>
              <li>Analyze competitor data</li>
            </ul>
            
            <p>Start building your business strategy today!</p>
          </div>
        </div>
      </body>
      </html>
    `

    const text = `Welcome to Pixelated Business Strategy CMS! Start building your business strategy today.`

    return { subject, html, text }
  }

  private generatePasswordResetTemplate(resetToken: string): EmailTemplate {
    const subject = 'Reset your password'
    const resetUrl = `https://pixelated.com/reset-password?token=${resetToken}`

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
          .header { background: #2563eb; color: white; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset</h1>
          </div>
          
          <div style="padding: 20px;">
            <p>Click the button below to reset your password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>This link will expire in 1 hour.</p>
          </div>
        </div>
      </body>
      </html>
    `

    const text = `Password reset requested. Visit: ${resetUrl}`

    return { subject, html, text }
  }

  private generateDocumentSharedTemplate(
    documentName: string,
    sharedBy: string,
    accessUrl: string,
  ): EmailTemplate {
    const subject = `📄 Document Shared: ${documentName}`

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Document Shared</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
          .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Document Shared</h2>
          <p><strong>${sharedBy}</strong> has shared <strong>${documentName}</strong> with you.</p>
          <a href="${accessUrl}" class="button">View Document</a>
        </div>
      </body>
      </html>
    `

    const text = `${sharedBy} has shared ${documentName} with you. Access: ${accessUrl}`

    return { subject, html, text }
  }

  private generateCollaborationInviteTemplate(
    documentName: string,
    invitedBy: string,
    accessUrl: string,
  ): EmailTemplate {
    const subject = `🤝 Collaboration Invitation: ${documentName}`

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Collaboration Invitation</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
          .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Collaboration Invitation</h2>
          <p><strong>${invitedBy}</strong> has invited you to collaborate on <strong>${documentName}</strong>.</p>
          <a href="${accessUrl}" class="button">Join Collaboration</a>
        </div>
      </body>
      </html>
    `

    const text = `${invitedBy} has invited you to collaborate on ${documentName}. Join: ${accessUrl}`

    return { subject, html, text }
  }
}
