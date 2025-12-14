import type { APIContext } from 'astro'
import { createBuildSafeLogger } from '../../../lib/logging/build-safe-logger'
import { AuditEventType, logAuditEvent } from '../../../lib/audit'
import { z } from 'zod'
import { mongoAuthService } from '../../../lib/db/mongoClient'
import { getEmailService } from '../../../lib/email'

const logger = createBuildSafeLogger('reset-password')

const ResetPasswordSchema = z.object({
  email: z.string().email(),
})

export const POST = async ({ request }: APIContext) => {
  try {
    const body = await request.json()
    const { email } = ResetPasswordSchema.parse(body)

    logger.info('Password reset requested', {
      email: email.substring(0, 3) + '***',
    })

    try {
      const resetToken = await mongoAuthService.createPasswordResetToken(email)

      const origin = new URL(request.url).origin
      const resetLink = `${origin}/auth/reset-password?token=${resetToken}`

      const emailService = getEmailService()
      await emailService.sendEmail({
        to: email,
        subject: 'Password Reset Request',
        htmlContent: `
          <h1>Password Reset Request</h1>
          <p>Click the link below to reset your password:</p>
          <a href="${resetLink}">${resetLink}</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you did not request this, please ignore this email.</p>
        `,
        textContent: `Password Reset Request\n\nClick the link below to reset your password:\n${resetLink}\n\nThis link will expire in 1 hour.\nIf you did not request this, please ignore this email.`,
      })

      logger.info('Password reset email sent', {
        email: email.substring(0, 3) + '***',
      })
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      if (errorMessage === 'User not found') {
        logger.info('Password reset requested for non-existent user', {
          email: email.substring(0, 3) + '***',
        })
        // Swallow error to simulate success
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
