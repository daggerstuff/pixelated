import { developerApiKeyManager } from "@/lib/db/developer-api-keys";
import { logSecurityEvent, SecurityEventType } from "@/lib/security";

import { protectRoute } from "../../../../../lib/auth/serverAuth";

export const prerender = false;

function extractIdFromPath(request: Request): string {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? "";
}

/**
 * GET /api/v1/admin/api-keys/[id]
 * Returns a single API key (system-wide access).
 * Admin-only, no-store headers.
 */
export const GET = protectRoute({
  requiredRole: "admin",
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ request }) => {
  try {
    const id = extractIdFromPath(request);
    if (!id) {
      return new Response(JSON.stringify({ error: "API key ID is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    const allKeys = await developerApiKeyManager.listAllApiKeys();
    const apiKey = allKeys.find((k) => k.id === id);

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    return new Response(JSON.stringify({ api_key: apiKey }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }
});

/**
 * DELETE /api/v1/admin/api-keys/[id]
 * Revokes any API key (system-wide).
 * Admin-only, no-store headers.
 */
export const DELETE = protectRoute({
  requiredRole: "admin",
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ request }) => {
  try {
    const id = extractIdFromPath(request);
    if (!id) {
      return new Response(JSON.stringify({ error: "API key ID is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    const revoked = await developerApiKeyManager.revokeApiKeySystem(id);

    if (!revoked) {
      return new Response(JSON.stringify({ error: "API key not found or already revoked" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    logSecurityEvent(SecurityEventType.AUTHORIZATION_FAILED, "system", {
      action: "admin_api_key_revoked",
      key_id: id,
    });

    return new Response(JSON.stringify({ success: true, message: "API key revoked by admin" }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }
});

/**
 * GET /api/v1/admin/api-keys/[id]/usage
 * Returns rate limit usage for any API key.
 * Admin-only, no-store headers.
 */
export const POST = protectRoute({
  requiredRole: "admin",
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ request }) => {
  try {
    const id = extractIdFromPath(request);
    if (!id) {
      return new Response(JSON.stringify({ error: "API key ID is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    const usage = await developerApiKeyManager.getApiKeyUsage(id);

    return new Response(JSON.stringify({ usage }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }
});
