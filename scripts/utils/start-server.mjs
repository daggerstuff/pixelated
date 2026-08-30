#!/usr/bin/env node

import process from "process";
import { createServer, request as httpRequest } from "http";
import { createServer as createHttpsServer } from "https";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Try to import Sentry from either the local development path or the production path
/** @typedef {import('../../config/instrument.mjs').SentryInstance} SentryInstance */
/** @typedef {{ Sentry: SentryInstance; closeSentry: () => Promise<void> }} SentryModule */
/** @typedef {{ handler: import('http').RequestListener }} SSRModule */
/** @typedef {Error & { code?: string }} ErrorWithCode */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** @param {unknown} value @returns {value is Error} */
const isError = (value) => value instanceof Error;

/** @param {unknown} value @returns {value is ErrorWithCode} */
const isErrorWithCode = (value) => isError(value) && typeof value.code === "string";

/** @param {unknown} value @returns {value is SSRModule} */
const isSSRModule = (value) => isRecord(value) && typeof value.handler === "function";

/** @param {unknown} value @returns {value is SentryModule} */
const isSentryModule = (value) =>
  isRecord(value) &&
  isRecord(value.Sentry) &&
  typeof value.Sentry.captureException === "function" &&
  typeof value.Sentry.close === "function" &&
  typeof value.closeSentry === "function";

/** @param {unknown} value @returns {Error} */
const toError = (value) => (isError(value) ? value : new Error(String(value)));

/** @type {SentryInstance} */
let Sentry = createStubSentry();
/** @type {() => Promise<void>} */
let closeSentry = async () => {};

const loadSentryModule = async () => {
  const candidates = ["../../config/instrument.mjs", "./instrument.mjs"];
  /** @type {unknown} */
  let lastError;

  for (const candidate of candidates) {
    try {
      /** @type {unknown} */
      const moduleExports = await import(candidate);
      if (isSentryModule(moduleExports)) {
        Sentry = moduleExports.Sentry;
        closeSentry = moduleExports.closeSentry;
        return;
      }
      throw new Error(`Invalid Sentry module shape from ${candidate}`);
    } catch (error) {
      lastError = error;
    }
  }

  const errorMessage = toError(lastError).message;
  console.warn("⚠️ Could not load Sentry instrumentation:", errorMessage);
  Sentry = createStubSentry();
  closeSentry = async () => {};
};

await loadSentryModule();

function createStubSentry() {
  /** @type {SentryInstance} */
  return {
    captureException: () => {},
    init: () => {},
    close: async () => {},
  };
}

import { getPortFallbackPolicy, resolveSsrEntryModuleUrl } from "./start-server-config.mjs";

function resolveSentryDsn() {
  return (
    process.env.SENTRY_DSN ??
    process.env.PUBLIC_SENTRY_DSN ??
    process.env.SENTRY_PUBLIC_DSN ??
    process.env.VITE_SENTRY_DSN
  );
}

/** @type {unknown} */
const ssrModuleCandidate = await import(await resolveSsrEntryModuleUrl());
if (!isSSRModule(ssrModuleCandidate)) {
  throw new Error("Failed to import SSR module with expected handler export.");
}
const ssrModule = ssrModuleCandidate;
const ssrHandler = ssrModule.handler;

// ── Static file middleware for Astro middleware mode ────────────────────
// When @astrojs/node runs in "middleware" mode, entry.mjs exports only the
// SSR handler — it does NOT serve dist/client/ static files.  We need to
// check dist/client/ for matching files before falling through to SSR.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = existsSync(path.join(__dirname, "dist/client"))
  ? path.join(__dirname, "dist/client")
  : path.resolve(__dirname, "../../dist/client");
// Rooted prefix (with trailing separator) so sibling directories cannot
// match the clientDist prefix during the traversal check below.
const clientDistRoot = clientDist.endsWith(path.sep) ? clientDist : `${clientDist}${path.sep}`;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".pdf": "application/pdf",
};

/** @param {string} filePath */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

/** @param {string} urlPath @returns {string | null} */
function resolveStaticFile(urlPath) {
  const normalized = urlPath.split("?")[0].split("#")[0];

  // Resolve against clientDist, default to index.html for root
  const filePath = path.join(clientDist, normalized === "/" ? "index.html" : normalized);

  // Prevent directory traversal — resolved path must stay inside clientDist
  if (filePath !== clientDist && !filePath.startsWith(clientDistRoot)) return null;

  // Try exact match first (must be a file with an extension)
  if (existsSync(filePath) && path.extname(filePath)) {
    return filePath;
  }

  // Try + .html (Astro outputs clean URLs like /about.html for /about)
  const withHtml = filePath + ".html";
  if (existsSync(withHtml) && path.extname(withHtml)) {
    return withHtml;
  }

  return null;
}

// ── Analytics (umami) host-based reverse proxy ──────────────────────────
// analytics.pixelatedempathy.com is a CNAME to pixelatedempathy.com, so its
// traffic arrives at this server (the main app's LoadBalancer) — NOT at the
// separate Traefik ingress. Without routing, the umami tracking script
// (script.js) request fell through to a full Astro SSR render on every page
// load. Proxy that host to the umami service so the dashboard + tracking
// script are served fast and correctly.
const UMAMI_ANALYTICS_HOST = (
  process.env.UMAMI_ANALYTICS_HOST ?? "analytics.pixelatedempathy.com"
).toLowerCase();
const UMAMI_UPSTREAM =
  process.env.UMAMI_UPSTREAM ?? "http://umami.pixelated-empathy.svc.cluster.local:80";

/** @type {URL | null} */
let umamiUpstream = null;
try {
  umamiUpstream = new URL(UMAMI_UPSTREAM);
} catch {
  console.error(`Invalid UMAMI_UPSTREAM URL: ${UMAMI_UPSTREAM}. Analytics proxy disabled.`);
}

/** @param {string | undefined} hostHeader @returns {boolean} */
function isUmamiAnalyticsHost(hostHeader) {
  if (!hostHeader) return false;
  // Strip an optional port (e.g. "analytics.pixelatedempathy.com:443").
  return hostHeader.split(":")[0].toLowerCase() === UMAMI_ANALYTICS_HOST;
}

/** @param {import('http').IncomingMessage} req @param {import('http').ServerResponse} res @returns {boolean} */
function proxyToUmami(req, res) {
  if (!umamiUpstream || !isUmamiAnalyticsHost(req.headers.host)) {
    return false;
  }

  const upstreamReq = httpRequest(
    {
      hostname: umamiUpstream.hostname,
      port: umamiUpstream.port || 80,
      method: req.method,
      path: req.url,
      headers: {
        ...req.headers,
        // Preserve the external host so umami builds correct absolute URLs.
        host: req.headers.host ?? UMAMI_ANALYTICS_HOST,
        "x-forwarded-proto": req.socket.encrypted ? "https" : "http",
        "x-forwarded-host": req.headers.host ?? UMAMI_ANALYTICS_HOST,
      },
    },
    (upstreamRes) => {
      const headers = { ...upstreamRes.headers };
      // Let Node manage framing — drop hop-by-hop headers.
      delete headers["connection"];
      delete headers["keep-alive"];
      delete headers["transfer-encoding"];
      delete headers["upgrade"];
      delete headers["te"];
      delete headers["trailer"];
      delete headers["proxy-authenticate"];
      delete headers["proxy-authorization"];
      res.writeHead(upstreamRes.statusCode ?? 502, headers);
      upstreamRes.pipe(res);
    },
  );

  upstreamReq.on("error", (err) => {
    console.error("Umami proxy error:", err);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end("Bad Gateway");
  });

  req.pipe(upstreamReq);
  return true;
}

/** @type {import('http').RequestListener} */
function staticAwareHandler(req, res) {
  if (proxyToUmami(req, res)) {
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return ssrHandler(req, res);
  }

  const staticPath = resolveStaticFile(req.url ?? "/");
  if (staticPath) {
    try {
      const content = readFileSync(staticPath);
      const contentType = getMimeType(staticPath);
      // Immutable cache for hashed assets (everything under /assets/),
      // no-cache for everything else (HTML, etc.)
      const cacheControl = staticPath.includes("/assets/")
        ? "public, max-age=31536000, immutable"
        : "no-cache";
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": content.length,
        "Cache-Control": cacheControl,
      });
      res.end(content);
      return;
    } catch {
      // File disappeared between existsSync and readFileSync — fall through to SSR
    }
  }

  ssrHandler(req, res);
}

const rawPort = process.env.PORT ?? process.env.WEBSITES_PORT;
const parsedPort = rawPort !== undefined ? Number(rawPort) : NaN;
let initialPort =
  Number.isFinite(parsedPort) && parsedPort >= 0 && parsedPort <= 65535 ? parsedPort : 4321;
if (Number.isNaN(initialPort) || initialPort < 0 || initialPort > 65535) {
  console.error(`Invalid port: ${initialPort}. Falling back to default port 4321.`);
  initialPort = 4321;
}
const host = process.env.HOST ?? "0.0.0.0";

const portFallbackPolicy = getPortFallbackPolicy(process.env);
const isPortFallbackDisabled = portFallbackPolicy.isFallbackDisabled;

// Note: We create the server inside tryListen() to avoid port conflicts
// The unused 'server' object was removed to prevent double-binding issues
/** @type {import('http').Server | null} */
let activeRetryServer = null;

function redactValue(val, keepLast = 8) {
  if (!val) {
    return "<missing>";
  }
  try {
    const s = String(val);
    if (s.length <= keepLast + 4) {
      return "REDACTED";
    }
    return `${s.slice(0, 4)}...${s.slice(-keepLast)}`;
  } catch (e) {
    console.error("Error in redactValue:", e);
    return "<invalid>";
  }
}

function logSentryStartupChecks() {
  const serverDsn = resolveSentryDsn();
  const publicDsn = resolveSentryDsn() ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  const release = process.env.SENTRY_RELEASE;
  const authToken = process.env.SENTRY_AUTH_TOKEN;

  console.log("Sentry startup check:");
  console.log("  SENTRY_DSN:", serverDsn ? redactValue(serverDsn) : "<missing>");
  console.log("  PUBLIC_SENTRY_DSN:", publicDsn ? redactValue(publicDsn) : "<missing>");
  console.log(
    "  SENTRY_RELEASE:",
    typeof release === "string" && release.length ? release : "<missing>",
  );
  console.log("  SENTRY_AUTH_TOKEN provided:", !!authToken);
  if (!serverDsn) {
    console.warn("Warning: Sentry DSN is not set — server-side events will not be sent to Sentry.");
  }
  if (!release) {
    console.warn(
      "Warning: SENTRY_RELEASE is not set — sessions or releases may be rejected by Sentry.",
    );
  }
}

// Error handling is now done within tryListen() for the retryServer
// Removed unused server.on('error') handler that was causing conflicts

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  try {
    const s = activeRetryServer;
    if (s) {
      s.removeAllListeners("error");
      s.close(() => {
        console.log("Process terminated");
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  } catch {
    process.exit(0);
  }
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  try {
    const s = activeRetryServer;
    if (s) {
      s.removeAllListeners("error");
      s.close(() => {
        console.log("Process terminated");
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  } catch {
    process.exit(0);
  }
});

const baseDelay = 250;
const maxDelay = 5000;

function tryListen(portToTry, retriesLeft, delay = baseDelay) {
  let port = Number(portToTry);
  if (Number.isNaN(port) || port < 0 || port > 65535) {
    console.error(`Invalid port: ${portToTry}. Falling back to default port 4321.`);
    port = 4321;
  }

  // If there's an existing retry server, close and detach it so it can be
  // garbage collected before creating a new one.
  const oldServer = activeRetryServer;
  if (oldServer) {
    try {
      // Only clear 'error' listeners to avoid touching other process-wide
      // handlers that may be registered elsewhere.
      oldServer.removeAllListeners("error");
      oldServer.close(() => {});
    } catch {
      // ignore
    }
    activeRetryServer = null;
  }

  // Create a fresh server for this listen attempt. We keep a reference in
  // activeRetryServer so we can clean it up on the next retry.
  const retryServer = createServer(staticAwareHandler);
  activeRetryServer = retryServer;

  const onListening = () => {
    retryServer.off("error", onError);
    console.log(`Server running at http://${host}:${port}`);
    try {
      logSentryStartupChecks();
    } catch (e) {
      console.error("Failed to run Sentry startup checks:", e);
    }
  };

  const onError = (rawErr) => {
    const err = toError(rawErr);
    if (isErrorWithCode(err) && err.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use.`);

      if (isPortFallbackDisabled) {
        console.error(
          `Port fallback disabled by environment (${portFallbackPolicy.reasons.join(", ")}). Exiting.`,
        );
        // Only report to Sentry when port fallback is disabled (fatal error)
        try {
          Sentry.captureException(err, {
            tags: {
              fatal: true,
              port_fallback_disabled: true,
            },
          });
        } catch (e) {
          console.error("Failed to capture EADDRINUSE to Sentry:", e);
        }
        void closeSentry().finally(() => process.exit(1));
        return;
      }

      if (retriesLeft <= 0) {
        console.error("No retries left for port fallback. Exiting.");
        // Only report to Sentry when retries are exhausted (fatal error)
        try {
          Sentry.captureException(err, {
            tags: {
              fatal: true,
              retries_exhausted: true,
            },
          });
        } catch (e) {
          console.error("Failed to capture EADDRINUSE to Sentry:", e);
        }
        void closeSentry().finally(() => process.exit(1));
        return;
      }

      // Port fallback is enabled and retries are available - don't report to Sentry
      // This is expected behavior and will be handled gracefully
      const nextPort = port + 1;
      const nextDelay = Math.min(delay * 2, maxDelay);
      console.warn(
        `Attempting fallback to port ${nextPort} (${retriesLeft - 1} retries left, delay ${delay}ms)`,
      );
      setTimeout(() => tryListen(nextPort, retriesLeft - 1, nextDelay), delay);
      return;
    }

    console.error("Listen error:", err);
    // Report non-EADDRINUSE errors to Sentry as they are unexpected
    try {
      Sentry.captureException(err);
    } catch (e) {
      console.error("Failed to capture listen error to Sentry:", e);
    }
  };

  retryServer.once("error", onError);
  retryServer.listen(port, host, onListening);
}

const retriesRaw = process.env.PORT_FALLBACK_MAX_RETRIES;
let maxRetries;
{
  const n = retriesRaw !== undefined ? Number.parseInt(retriesRaw, 10) : NaN;
  maxRetries = Number.isFinite(n) && n >= 0 ? n : 10;
}
tryListen(initialPort, maxRetries);
// Conditional HTTPS server for Cloudflare Origin TLS
(function startHttpsServer() {
  const httpsCertPath = process.env.HTTPS_CERT_PATH;
  const httpsKeyPath = process.env.HTTPS_KEY_PATH;
  const httpsPortRaw = process.env.HTTPS_PORT;
  const httpsPort = httpsPortRaw ? Number(httpsPortRaw) : 8443;

  if (
    !httpsCertPath ||
    !httpsKeyPath ||
    !Number.isFinite(httpsPort) ||
    httpsPort < 0 ||
    httpsPort > 65535
  ) {
    return;
  }

  try {
    const cert = readFileSync(httpsCertPath, "utf8");
    const key = readFileSync(httpsKeyPath, "utf8");

    const httpsServer = createHttpsServer({ key, cert }, staticAwareHandler);
    httpsServer.listen(httpsPort, host, () => {
      console.log(`HTTPS server running at https://${host}:${httpsPort}`);
    });
    httpsServer.on("error", (err) => {
      console.error("HTTPS server error:", err);
      Sentry.captureException(err);
    });
  } catch (err) {
    console.error("Failed to start HTTPS server:", err);
    Sentry.captureException(err);
  }
})();

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  try {
    Sentry.captureException(toError(reason));
  } catch (e) {
    console.error("Failed to capture unhandledRejection to Sentry:", e);
  }
  void closeSentry().finally(() => process.exit(1));
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  try {
    Sentry.captureException(toError(err));
  } catch (e) {
    console.error("Failed to capture uncaughtException to Sentry:", e);
  }
  void closeSentry().finally(() => process.exit(1));
});
