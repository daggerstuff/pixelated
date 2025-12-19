import type { APIContext } from 'astro'
import { createBuildSafeLogger } from '../../../lib/logging/build-safe-logger'
import { AuditEventType, logAuditEvent } from '../../../lib/audit'
import { z } from 'zod'
import { mongoAuthService, UserNotFoundError } from '../../../lib/db/mongoClient'
import { getEmailService } from '../../../lib/email'
import { config } from '../../../config/env.config'
import rateLimitConfig from '../../../config/rate-limit.config'
import { createRateLimiter } from '../../../lib/rate-limiting/rate-limiter'
import { defaultRateLimitConfig, defaultRuleSets } from '../../../lib/rate-limiting/config'
import { promises as fs } from 'fs'
import { join } from 'path'

// Simple HTML escape function to prevent XSS in email templates
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  }

  return text.replace(/[&<>"'\/]/g, (match) => htmlEscapes[match])
}

// Email template for password reset
async function getPasswordResetEmailTemplate(resetLink: string, email: string): Promise<{ html: string; text: string }> {
  // Use a fixed path relative to the project root
  const templateDir = join(process.cwd(), 'src/templates/emails')

  // Read template files
  const htmlTemplate = await fs.readFile(join(templateDir, 'password-reset.html'), 'utf-8')
    .catch(() => {
      // Fallback to inline template if file reading fails
      return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Request</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; text-align: center;">
        <h1 style="color: #2c3e50; margin-bottom: 20px;">Password Reset Request</h1>
        <p style="font-size: 16px; margin-bottom: 25px;">
            Click the button below to reset your password:
        </p>
        <a href="${escapeHtml(resetLink)}"
           style="display: inline-block; background-color: #007bff; color: white; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: bold; margin: 20px 0;">
            Reset Password
        </a>
        <p style="font-size: 14px; color: #666; margin-top: 25px;">
            This link will expire in 1 hour. If you did not request this password reset, please ignore this email.
        </p>
    </div>
</body>
</html>`
    })

  const textTemplate = await fs.readFile(join(templateDir, 'password-reset.txt'), 'utf-8')
    .catch(() => {
      // Fallback to inline template if file reading fails
      return `Password Reset Request

Click the link below to reset your password:
${resetLink}

This link will expire in 1 hour.

If you did not request this password reset, please ignore this email.`
    })

  // Simple template replacement
  const year = new Date().getFullYear()

  const htmlContent = htmlTemplate
    .replace('{{resetLink}}', escapeHtml(resetLink))
    .replace('{{email}}', escapeHtml(email))
    .replace('{{year}}', year.toString())

  const textContent = textTemplate
    .replace('{{resetLink}}', resetLink)
    .replace('{{email}}', email)
    .replace('{{year}}', year.toString())

  return { html: htmlContent.trim(), text: textContent.trim() }
}

// Get the password reset rule from the auth_endpoints rule set
const passwordResetRuleSet = defaultRuleSets.find(set => set.name === 'auth_endpoints')
const passwordResetRule = passwordResetRuleSet?.rules.find(rule => rule.name === 'password_reset') || {
  name: 'password_reset',
  maxRequests: 3, // Conservative limit for password reset
  windowMs: 3600000, // 1 hour
}

// Create rate limiter instance
const rateLimiter = createRateLimiter(defaultRateLimitConfig)

const logger = createBuildSafeLogger('reset-password')

const ResetPasswordSchema = z.object({
  email: z.string().email(),
})

export const POST = async ({ request, clientAddress }: APIContext) => {
  try {
    // Rate limiting check
    const clientIp = clientAddress || request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitResult = await rateLimiter.checkLimit(clientIp, passwordResetRule)

    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded for password reset request', {
        clientIp,
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime,
      })

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Too many password reset requests. Please try again later.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toISOString(),
          },
        },
      )
    }
    const body = await request.json()
    const { email } = ResetPasswordSchema.parse(body)

    logger.info('Password reset requested', {
      email: email.substring(0, 3) + '***',
    })

    try {
      const resetToken = await (mongoAuthService as any).createPasswordResetToken(email)

      // Use configured SITE_URL if available, otherwise fall back to request origin
      const siteUrl = config.site.url()
      const baseUrl = siteUrl || new URL(request.url).origin

      // Use URL constructor for proper URL building
      const resetUrl = new URL('/auth/reset-password', baseUrl)
      resetUrl.searchParams.set('token', resetToken)
      const resetLink = resetUrl.toString()

      const emailService = getEmailService()
      const emailTemplate = await getPasswordResetEmailTemplate(resetLink, email)

      const emailResult = await emailService.sendEmail({
        to: email,
        subject: 'Password Reset Request',
        htmlContent: emailTemplate.html,
        textContent: emailTemplate.text,
      })

      if (!emailResult.success) {
        logger.error('Failed to send password reset email', {
          email: email.substring(0, 3) + '***',
          error: emailResult.error,
          provider: emailResult.provider,
        })
        throw new Error(`Failed to send password reset email: ${emailResult.error}`)
      }

      logger.info('Password reset email sent', {
        email: email.substring(0, 3) + '***',
      })
    } catch (error: unknown) {
      if (error instanceof UserNotFoundError) {
        logger.info('Password reset requested for non-existent user', {
          email: email.substring(0, 3) + '***',
        })
        // Swallow error to simulate success (prevent email enumeration)
      } else {
        throw error
      }
    }

    // Log the password reset attempt
    await logAuditEvent(
      AuditEventType.SECURITY,
      'password_reset_request',
      'anonymous',
      'auth',
      { email },
    )

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password reset email sent successfully',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error: unknown) {
    logger.error('Password reset error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Internal server error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}