import { NextResponse } from "next/server";
import { getSessionFromToken, isSessionValid } from "@/lib/auth/session";

/**
 * Middleware to protect routes requiring authentication
 * Use on API routes or pages that require login
 */
export async function withAuth(
  handler: (request: Request) => Promise<NextResponse>,
  options?: {
    allowAnonymous?: boolean[]; // Optional list of routes that don't require auth
  },
) {
  // Check if this route should allow anonymous access
  if (options?.allowAnonymous?.includes(request.nextUrl.pathname)) {
    return await handler(request);
  }

  // Get authentication token from cookies or headers
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  // Try to get session from token
  const session = await getSessionFromToken({
    accessToken: token,
    sub: "", // Not used here
    iat: 0,
    exp: 0,
    role: "", // Not used here
  });

  // Check if session is valid
  if (!session || !isSessionValid(session)) {
    return new NextResponse(
      JSON.stringify({ error: "Authentication required" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  // Session is valid, proceed with request
  return await handler(request);
}

// Example usage:
// export default withAuth(myApiHandler, { allowAnonymous: ['/api/public'] })
// export const GET = withAuth(myHandler)
// export const POST = withAuth(myHandler)

// Optional: Add direct export for common use cases
export { withAuth };
