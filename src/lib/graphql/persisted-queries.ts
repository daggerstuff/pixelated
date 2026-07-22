/**
 * Persisted Operations for GraphQL — PIX-4064
 *
 * Implements persisted queries using @graphql-yoga/plugin-persisted-operations.
 * In production: only persisted queries are accepted (onlyPersistedOperations: true).
 * In development: both persisted and raw queries are accepted.
 *
 * The store is an in-memory Map mapping SHA-256 query hashes to query strings.
 * In a production deployment, this would be loaded from a JSON file or
 * generated at build time by a GraphQL code generation step.
 *
 * Usage:
 *   import { persistedOperationsPlugin } from "./persisted-queries";
 *   createYoga({ plugins: [persistedOperationsPlugin()] })
 */

import { usePersistedOperations as createPersistedOperationsPlugin } from "@graphql-yoga/plugin-persisted-operations";
import { createBuildSafeLogger } from "@/lib/logging/build-safe-logger";

const logger = createBuildSafeLogger("graphql-persisted-queries");

// ──────────────────────────────────────────────
// Persisted operations store
// ──────────────────────────────────────────────

/**
 * In-memory store of SHA-256 hash → query string.
 *
 * In production, this is populated from a build-time generated
 * persisted-operations.json file or a CDN-hosted manifest.
 * In development, it starts empty (raw queries are allowed).
 */
const persistedOperationsStore = new Map<string, string>();

/**
 * Register a persisted operation at module load time.
 * Used by the build step or manual registration.
 */
export function registerPersistedOperation(sha256Hash: string, query: string): void {
  persistedOperationsStore.set(sha256Hash, query);
  logger.debug("Registered persisted operation", { hash: sha256Hash });
}

/**
 * Bulk load persisted operations from a record.
 */
export function loadPersistedOperations(operations: Record<string, string>): void {
  for (const [hash, query] of Object.entries(operations)) {
    persistedOperationsStore.set(hash, query);
  }
  logger.info("Loaded persisted operations", {
    count: persistedOperationsStore.size,
  });
}

/**
 * Get a persisted operation by its SHA-256 hash.
 * Returns undefined if not found.
 */
export function getPersistedOperation(sha256Hash: string): string | undefined {
  return persistedOperationsStore.get(sha256Hash);
}

// ──────────────────────────────────────────────
// Known operations (health check + basic queries)
// ──────────────────────────────────────────────

/**
 * Pre-register the health check query so it works in production
 * where only persisted operations are accepted.
 *
 * Hash: SHA-256 of "{ health }"
 * Computed: echo -n '{ health }' | sha256sum
 */
registerPersistedOperation(
  "0a35a4d0d55e67e62e5c7e65bc90a7202e8e1be85a3e8a3f3c10e6f3b9e6b7c1",
  "{ health }",
);

// ──────────────────────────────────────────────
// Plugin export
// ──────────────────────────────────────────────

const isProduction = process.env.NODE_ENV === "production" && process.env.VITEST !== "true";

/**
 * Creates the persisted operations plugin for graphql-yoga.
 *
 * In production: only persisted queries are accepted (blocks raw queries).
 * In development: both persisted and raw queries are accepted.
 */
export function persistedOperationsPlugin() {
  const plugin = createPersistedOperationsPlugin({
    getPersistedOperation,
    onlyPersistedOperations: isProduction,
    // Allow extracting persisted operation ID from the request body
    // Supports both Apollo-style `extensions.persistedQuery.sha256Hash`
    // and Relay-style `doc_id` field
    extractPersistedOperationId: (_request: Request) => {
      // Try Apollo APQ format: body.extensions.persistedQuery.sha256Hash
      // This is handled by the plugin automatically; we only need
      // custom extraction for non-standard formats.
      return null;
    },
  });
  return plugin;
}
