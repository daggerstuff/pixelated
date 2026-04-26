import { z } from "zod";
import { developerApiKeyManager } from "@/lib/db/developer-api-keys";
import { VALID_API_KEY_SCOPES, DEFAULT_API_KEY_SCOPES } from "@/lib/auth/scopes";
import { jsonError, jsonResponse } from "@/pages/api/memory/_shared";
import { withAuth } from "@/middleware/auth";
import { logSecurityEvent, SecurityEventType } from "@/lib/security";

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.enum(VALID_API_KEY_SCOPES)).optional().default(DEFAULT_API_KEY_SCOPES),
  rate_limit: z.number().int().min(1).max(10000).optional().default(1000),
  expires_in_days: z.number().int().min(1).max(365).optional(),
});

const MAX_KEYS_PER_USER = 10;

export const GET = withAuth(async (request, session) => {
  const keys = await developerApiKeyManager.listApiKeys(session.user.id);
  return jsonResponse({ keys });
});

export const POST = withAuth(async (request, session) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Bad Request", "Invalid JSON body");
  }

  const parseResult = CreateApiKeySchema.safeParse(body);
  if (!parseResult.success) {
    return jsonError(400, "Bad Request", parseResult.error.issues[0].message);
  }

  const { name, scopes, rate_limit, expires_in_days } = parseResult.data;

  const existingKeys = await developerApiKeyManager.listApiKeys(session.user.id);
  if (existingKeys.length >= MAX_KEYS_PER_USER) {
    await logSecurityEvent(SecurityEventType.AUTHORIZATION_FAILED, session.user.id, {
      reason: "api_key_limit_exceeded",
      current_count: existingKeys.length,
      max_allowed: MAX_KEYS_PER_USER,
    });
    return jsonError(429, "Too Many Requests", `Maximum of ${MAX_KEYS_PER_USER} API keys per user`);
  }

  const result = await developerApiKeyManager.createApiKey({
    user_id: session.user.id,
    name,
    scopes,
    rate_limit,
    expires_in_days,
  });

  await logSecurityEvent(SecurityEventType.AUTHENTICATION_SUCCESS, session.user.id, {
    action: "api_key_created",
    key_id: result.api_key.id,
    key_prefix: result.api_key.key_prefix,
    scopes,
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
