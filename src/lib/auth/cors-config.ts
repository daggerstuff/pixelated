export const DEVELOPER_CORS_CONFIG = {
  allowedOrigins: [
    "https://app.pixelatedempathy.com",
    "https://api.pixelatedempathy.com",
    process.env.DEV_ALLOWED_ORIGIN || "http://localhost:3000",
    process.env.ALLOWED_ORIGIN || "http://localhost:4321",
  ].filter(Boolean),

  allowedMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-API-Key",
    "X-Request-ID",
    "X-Client-Version",
  ],

  exposedHeaders: [
    "X-Request-ID",
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
  ],

  maxAge: 86400,
  credentials: true,
};

export function isDeveloperApiRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.pathname.startsWith("/api/developer/") || url.pathname.startsWith("/api/v1/");
}

export function getDeveloperCorsHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get("Origin") || request.headers.get("origin");

  const hasApiKey = request.headers.get("X-API-Key") !== null;

  if (origin && (hasApiKey || DEVELOPER_CORS_CONFIG.allowedOrigins.includes(origin))) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", DEVELOPER_CORS_CONFIG.allowedMethods.join(", "));
    headers.set("Access-Control-Allow-Headers", DEVELOPER_CORS_CONFIG.allowedHeaders.join(", "));
    headers.set("Access-Control-Expose-Headers", DEVELOPER_CORS_CONFIG.exposedHeaders.join(", "));
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Max-Age", DEVELOPER_CORS_CONFIG.maxAge.toString());
    headers.set("Vary", "Origin");
  }

  return headers;
}
