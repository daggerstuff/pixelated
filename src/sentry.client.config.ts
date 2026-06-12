import { init as initClient } from "@sentry/astro";

import { initSentry, resolveSentryDsn, resolveSentryRelease } from "@/lib/sentry/config";

const clientDsn = resolveSentryDsn();

if (!clientDsn && import.meta.env.MODE === "production") {
  console.warn("[Sentry] Sentry DSN is missing. Client-side errors will not be sent.");
}

const clientConfig = initSentry({
  // Force browser DSN to explicit public-only config so we don't silently
  // fall back to a fallback DSN and lose traceability.
  dsn: resolveSentryDsn(),
  release: resolveSentryRelease(),
  integrations: [
    // Additional React-specific integrations can be added here
  ],
});

initClient(clientConfig);

// React 19 Error Handler
// Export for use in entry points that call createRoot
// Usage: import { createRoot } from 'react-dom/client'
//        const root = createRoot(container, {
//          onUncaughtError: reactErrorHandler(),
//          onCaughtError: reactErrorHandler(),
//          onRecoverableError: reactErrorHandler(),
//        })
export const reactErrorHandler = () => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const getWindowErrorHandler = (
    window as Window & { Sentry?: { reactErrorHandler?: () => unknown } }
  ).Sentry?.reactErrorHandler;

  if (typeof getWindowErrorHandler === "function") {
    try {
      const handler = getWindowErrorHandler();
      if (typeof handler === "function") {
        return handler;
      }
    } catch {
      // ignore and fall back to no-op
    }
  }

  if (import.meta.env.DEV) {
    return (error: unknown) => {
      console.error("[Sentry] reactErrorHandler fallback triggered:", error);
    };
  }

  return () => {};
};
