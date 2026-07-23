/**
 * GraphQL Yoga Server — PIX-4064
 *
 * Creates a graphql-yoga instance configured with:
 * - SDL schema + resolvers (modular monolithic, ready for federation split)
 * - Dual-mode auth context (JWT or API key via getCurrentUser)
 * - Depth limit (10) + complexity limit (1000)
 * - Introspection disabled in production
 * - graphql-ws subscriptions endpoint
 * - Persisted queries support (production)
 *
 * Route: /api/graphql (GET for health/GraphiQL, POST for queries)
 * WebSocket: /api/graphql (graphql-ws protocol for subscriptions)
 */

import { createYoga } from "graphql-yoga";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { GraphQLError } from "graphql";
import { getCurrentUser } from "@/lib/auth/index";
import { typeDefs } from "./schema";
import { resolvers, type GraphqlContext } from "./resolvers";
import { applyAuthDirectives } from "./auth-directive";
import {
  depthLimitRule,
  complexityLimitRule,
  isIntrospectionEnabled,
  formatGraphQLError,
} from "./security";
import { graphqlPubSub } from "./redis-pubsub";
import { persistedOperationsPlugin } from "./persisted-queries";
import { createBuildSafeLogger } from "@/lib/logging/build-safe-logger";

const logger = createBuildSafeLogger("graphql-server");

// ──────────────────────────────────────────────
// PubSub for subscriptions (Redis-backed with in-memory fallback)
// ──────────────────────────────────────────────

// graphqlPubSub uses Redis pub/sub when available, falls back to
// in-memory EventEmitter when Redis is not configured (dev).
// The resolvers import this to subscribe/publish events.
export { graphqlPubSub as pubsub };

// ──────────────────────────────────────────────
// Build executable schema with auth directives
// ──────────────────────────────────────────────

const rawSchema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

// Apply @auth and @requireRole directives — wraps resolvers with auth checks
const schema = applyAuthDirectives(rawSchema);

// ──────────────────────────────────────────────
// Auth context builder
// ──────────────────────────────────────────────

async function buildContext(request: Request): Promise<GraphqlContext> {
  try {
    const user = await getCurrentUser(request);
    return { user, request };
  } catch (err) {
    logger.error("Auth context build failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { user: null, request };
  }
}

// ──────────────────────────────────────────────
// Yoga server
// ──────────────────────────────────────────────

export const yoga = createYoga<GraphqlContext>({
  schema,
  context: ({ request }) => buildContext(request),
  graphqlEndpoint: "/api/graphql",

  // GraphiQL in dev only
  graphiql: isIntrospectionEnabled()
    ? {
        title: "Pixelated Empathy — GraphQL Playground",
        defaultQuery: `# Pixelated Empathy GraphQL API
# PIX-4064 — Federation Layer
#
# Auth: Bearer JWT or X-API-Key header
# Depth limit: 10 | Complexity limit: 1000

query {
  health
  sessions(limit: 5) {
    id
    clientId
    startTime
    endTime
    status
    sessionType
  }
}`,
      }
    : false,

  // Disable introspection in production
  introspection: isIntrospectionEnabled(),

  // Security: depth + complexity limits via envelop onValidate plugin
  plugins: [
    persistedOperationsPlugin(),
    {
      onValidate: ({ addValidationRule }: { addValidationRule: (rule: unknown) => void }) => {
        addValidationRule(depthLimitRule());
        addValidationRule(complexityLimitRule(schema));
      },
    },
  ],

  // Error formatting
  formatError: (error: GraphQLError) => {
    logger.error("GraphQL error", {
      message: error.message,
      path: error.path,
    });
    return formatGraphQLError(error);
  },

  // CORS
  cors: {
    origin: (request) => {
      const origin = request.headers.get("origin");
      // Allow same-origin in dev, specific origins in prod
      const env = (import.meta as Record<string, unknown>).env ?? process.env;
      const allowedOrigins = (env?.CORS_ALLOWED_ORIGINS as string)?.split(",") ?? [];
      if (!origin) return null;
      if (allowedOrigins.includes(origin)) return origin;
      // Dev: allow localhost
      if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
        return origin;
      }
      return null;
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    headers: ["Content-Type", "Authorization", "X-API-Key"],
  },

  // Health check endpoint
  healthCheckEndpoint: "/api/graphql/health",

  // Mask internal errors in production
  maskedErrors: !isIntrospectionEnabled(),
});

// ──────────────────────────────────────────────
// Export schema for testing
// ──────────────────────────────────────────────

export { schema };
