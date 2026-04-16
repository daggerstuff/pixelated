import { developerApiKeyManager } from "@/lib/db/developer-api-keys";
import { jsonError, jsonResponse } from "@/pages/api/memory/_shared";
import { withAuth } from "@/middleware/auth";

export const GET = withAuth(async (request, session) => {
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop() || "";

  const apiKey = await developerApiKeyManager.getApiKeyById(id, session.user.id);

  if (!apiKey) {
    return jsonError(404, "Not Found", "API key not found");
  }

  return jsonResponse({ api_key: apiKey });
});

export const DELETE = withAuth(async (request, session) => {
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop() || "";

  const revoked = await developerApiKeyManager.revokeApiKey(id, session.user.id);

  if (!revoked) {
    return jsonError(404, "Not Found", "API key not found or already revoked");
  }

  return jsonResponse({ success: true, message: "API key revoked" });
});

export const PATCH = withAuth(async (request, session) => {
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop() || "";

  const body = await request.json();
  const { scopes } = body;

  if (!scopes || !Array.isArray(scopes)) {
    return jsonError(400, "Bad Request", "scopes array is required");
  }

  const updated = await developerApiKeyManager.updateApiKeyScopes(id, session.user.id, scopes);

  if (!updated) {
    return jsonError(404, "Not Found", "API key not found or not active");
  }

  return jsonResponse({ success: true, message: "API key scopes updated" });
});
