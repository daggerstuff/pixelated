// import type { APIRoute } from 'astro'
import { mongoAuthService } from '@/services/mongoAuth.service'
import { AuditEventType, createAuditLog } from '@/lib/audit'

export const POST = async ({
  request,
}: {
  request: Request
}): Promise<Response> => {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No access token provided',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    const accessToken = authHeader.split(' ')[1]
    if (!accessToken) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid access token format',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    const {
      user,
      session,
      accessToken: newAccessToken,
    } = await mongoAuthService.refreshSession(accessToken)

    // Log the session refresh for HIPAA compliance
    await createAuditLog(
      AuditEventType.LOGIN,
      'auth.session.refresh',
      user._id.toString(),
      'auth',
      {
        userId: user._id.toString(),
        email: user.email,
        timestamp: new Date().toISOString(),
      },
    )

    return new Response(
      JSON.stringify({
        success: true,
        user,
        session,
        accessToken: newAccessToken,
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
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
