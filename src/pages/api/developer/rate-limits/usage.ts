import { withAuth } from "../../../../middleware/auth";
import { getRateLimitService } from "../../../../lib/rate-limit/RateLimitService";
import { API_TIERS, inferTierFromRateLimit } from "../../../../lib/rate-limit/types";
import { developerApiKeyManager } from "../../../../lib/db/developer-api-keys";

export const prerender = false;

export const GET = withAuth(
  async (request, session) => {
    const url = new URL(request.url);
    const keyId = url.searchParams.get("keyId");

    let apiKeyId: string | null = null;

    if (keyId) {
      // Verify ownership
      const key = await developerApiKeyManager.getApiKeyById(keyId, session.user.id);
      if (!key) {
        return new Response(
          JSON.stringify({
            error: "API key not found or does not belong to you",
          }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          },
        );
      }
      apiKeyId = keyId;
    } else {
      // Return all keys for this user
      const keys = await developerApiKeyManager.listApiKeys(session.user.id);
      const results = await Promise.all(
        keys.map(async (k) => {
          const tier = API_TIERS[inferTierFromRateLimit(k.rate_limit)];
          const service = getRateLimitService();
          return service.getUsage(k.id, tier);
        }),
      );
      return new Response(JSON.stringify({ keys: results }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    // Single key
    const keyRecord = await developerApiKeyManager.getApiKeyById(apiKeyId, session.user.id);
    if (!keyRecord) {
      return new Response(JSON.stringify({ error: "API key not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    const tier = API_TIERS[inferTierFromRateLimit(keyRecord.rate_limit)];
    const service = getRateLimitService();
    const usage = await service.getUsage(apiKeyId, tier);

    return new Response(JSON.stringify(usage), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  },
  { allowApiKey: false },
);
