import { supabase } from '@/lib/supabase'
import { createAuditLog, AuditEventType } from '@/lib/audit'
import { z } from 'zod'

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
})

export const POST = async ({ request }: { request: Request }) => {
  try {
    const body = await request.json()
    const { email, password, fullName } = RegisterSchema.parse(body)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
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

    if (data.user) {
      // Create user profile
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        role: 'user',
      })

      if (profileError) {
        // Log the error but don't fail the registration
        console.error('Error creating user profile:', profileError)
      }

      // Log the registration for HIPAA compliance
      await createAuditLog(
        AuditEventType.REGISTER,
        'auth.signup',
        data.user.id,
        'auth',
        {
          email: data.user.email,
          timestamp: new Date().toISOString(),
        },
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Registration successful. Please check your email for verification.',
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
