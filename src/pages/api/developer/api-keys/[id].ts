import { z } from "zod";
import { developerApiKeyManager } from "@/lib/db/developer-api-keys";
import { jsonError, jsonResponse } from "@/pages/api/memory/_shared";
import { withAuth } from "@/middleware/auth";
import { logSecurityEvent, SecurityEventType } from "@/lib/security";

const VALID_SCOPES = [
  "read",
  "write",
  "admin",
  "memory:read",
  "memory:write",
  "developer:manage",
  "analytics:read",
] as const;

const PatchApiKeySchema = z.object({
  scopes: z.array(z.enum(VALID_SCOPES)).min(1),
});

function extractIdFromPath(request: Request): string {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] || "";
}

export const GET = withAuth(async (request, session) => {
  const id = extractIdFromPath(request);

  if (!id) {
    return jsonError(400, "Bad Request", "API key ID is required");
  }

  const apiKey = await developerApiKeyManager.getApiKeyById(id, session.user.id);

  if (!apiKey) {
    return jsonError(404, "Not Found", "API key not found");
  }

  return jsonResponse({ api_key: apiKey });
});

export const DELETE = withAuth(async (request, session) => {
  const id = extractIdFromPath(request);

  if (!id) {
    return jsonError(400, "Bad Request", "API key ID is required");
  }

  const revoked = await developerApiKeyManager.revokeApiKey(id, session.user.id);

  if (!revoked) {
    return jsonError(404, "Not Found", "API key not found or already revoked");
  }

  await logSecurityEvent(SecurityEventType.AUTHENTICATION_SUCCESS, session.user.id, {
    action: "api_key_revoked",
    key_id: id,
  });

  return jsonResponse({ success: true, message: "API key revoked" });
});

export const PATCH = withAuth(async (request, session) => {
  const id = extractIdFromPath(request);

  if (!id) {
    return jsonError(400, "Bad Request", "API key ID is required");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Bad Request", "Invalid JSON body");
  }

  const parseResult = PatchApiKeySchema.safeParse(body);
  if (!parseResult.success) {
    return jsonError(400, "Bad Request", parseResult.error.issues[0].message);
  }

  const { scopes } = parseResult.data;

  const updated = await developerApiKeyManager.updateApiKeyScopes(id, session.user.id, scopes);

  if (!updated) {
    return jsonError(404, "Not Found", "API key not found or not active");
  }

  await logSecurityEvent(SecurityEventType.AUTHENTICATION_SUCCESS, session.user.id, {
    action: "api_key_scopes_updated",
    key_id: id,
    new_scopes: scopes,
  });

  return jsonResponse({ success: true, message: "API key scopes updated" });
});
