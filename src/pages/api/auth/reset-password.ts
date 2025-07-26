import { supabase } from '@/lib/supabase'
import { createAuditLog, AuditEventType } from '@/lib/audit'
import { z } from 'zod'

const ResetPasswordSchema = z.object({
  email: z.string().email(),
})

export const POST = async ({ request }: { request: Request }) => {
  try {
    const body = await request.json()
    const { email } = ResetPasswordSchema.parse(body)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${new URL(request.url).origin}/reset-password/confirm`,
    })

    if (error) {
      return new Response(
        JSON.stringify({
          success: false,
          message: error.message,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Log the password reset request for HIPAA compliance
    await createAuditLog(
      AuditEventType.PASSWORD_RESET,
      'auth.password.reset.request',
      'system',
      'auth',
      {
        email,
        timestamp: new Date().toISOString(),
      },
    )

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password reset instructions have been sent to your email.',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
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
