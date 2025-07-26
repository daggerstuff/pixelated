import { supabase } from '@/lib/supabase'
import { createAuditLog, AuditEventType } from '@/lib/audit'

export const POST = async ({ request }: { request: Request }) => {
  try {
    const { data, error } = await supabase.auth.refreshSession()

    if (error) {
      return new Response(
        JSON.stringify({
          success: false,
          message: error.message,
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    if (!data.session) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No session found',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Log the session refresh for HIPAA compliance
    await createAuditLog(
      AuditEventType.SESSION,
      'auth.session.refresh',
      data.user?.id || 'system',
      'auth',
      {
        userId: data.user?.id,
        email: data.user?.email,
        timestamp: new Date().toISOString(),
      },
    )

    return new Response(
      JSON.stringify({
        success: true,
        session: data.session,
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
