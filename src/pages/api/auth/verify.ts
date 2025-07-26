import { supabase } from '@/lib/supabase'
import { createAuditLog, AuditEventType } from '@/lib/audit'

export const GET = async ({ request }: { request: Request }) => {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    const type = url.searchParams.get('type')

    if (!token || !type) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Missing token or type parameter',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    let result
    if (type === 'email') {
      result = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'email',
      })
    } else if (type === 'recovery') {
      result = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'recovery',
      })
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid verification type',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    if (result.error) {
      return new Response(
        JSON.stringify({
          success: false,
          message: result.error.message,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Log the verification for HIPAA compliance
    await createAuditLog(
      AuditEventType.VERIFY,
      `auth.verify.${type}`,
      result.data?.user?.id || 'system',
      'auth',
      {
        type,
        userId: result.data?.user?.id,
        email: result.data?.user?.email,
        timestamp: new Date().toISOString(),
      },
    )

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Verification successful',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error) {
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
