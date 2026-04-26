import { apiKeyOnly } from "@/lib/auth/route-protection";
import { createProtectedHandler } from "@/lib/auth/route-protection";
import { developerApiKeyManager } from "@/lib/db/developer-api-keys";

const handler = async (request: Request): Promise<Response> => {
  if (request.method !== "POST" && request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const deletedCount = await developerApiKeyManager.cleanupOldRateLimits();

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cleaned up ${deletedCount} old rate limit records`,
        deleted: deletedCount,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Rate limit cleanup failed:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Cleanup failed",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const GET = createProtectedHandler(handler, apiKeyOnly(["admin"]));
export const POST = createProtectedHandler(handler, apiKeyOnly(["admin"]));
