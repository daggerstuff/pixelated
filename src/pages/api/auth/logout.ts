import { supabase } from '@/lib/supabase'
import { createAuditLog, AuditEventType } from '@/lib/audit'

export const POST = async ({ request }: { request: Request }) => {
  try {
    const { error } = await supabase.auth.signOut()

    if (error) {
      return new Response(
        JSON.stringify({
          success: false,
          message: error.message,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Log the sign out for HIPAA compliance
    await createAuditLog(
      AuditEventType.LOGOUT,
      'auth.signout',
      'system',
      'auth',
      {
        timestamp: new Date().toISOString(),
      },
    )

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully logged out',
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
