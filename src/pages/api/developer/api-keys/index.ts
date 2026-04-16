import { developerApiKeyManager } from "@/lib/db/developer-api-keys";
import { jsonError, jsonResponse } from "@/pages/api/memory/_shared";
import { withAuth } from "@/middleware/auth";

export const GET = withAuth(async (request, session) => {
  const keys = await developerApiKeyManager.listApiKeys(session.user.id);
  return jsonResponse({ keys });
});

export const POST = withAuth(async (request, session) => {
  const body = await request.json();
  const { name, scopes, rate_limit, expires_in_days } = body;

  if (!name) {
    return jsonError(400, "Bad Request", "name is required");
  }

  const result = await developerApiKeyManager.createApiKey({
    user_id: session.user.id,
    name,
    scopes,
    rate_limit,
    expires_in_days,
  });

  return jsonResponse(
    {
      api_key: result.api_key,
      plain_key: result.plain_key,
      message: "Store the plain_key securely. It will not be shown again.",
    },
    201,
  );
});
