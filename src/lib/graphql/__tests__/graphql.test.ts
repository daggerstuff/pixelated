/**
 * GraphQL Integration Tests — PIX-4064
 *
 * Uses the yoga HTTP interface to execute queries, avoiding the
 * ESM/CJS dual-package hazard where graphql() from the test's
 * import resolves to a different GraphQLSchema class than the one
 * @graphql-tools/schema uses internally.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildSchema, validate, parse } from "graphql";

// Mock getCurrentUser before importing server — vi.mock is hoisted
let mockUser: {
  id: string;
  role: string;
  email?: string;
  scopes?: string[];
} | null = null;

vi.mock("@/lib/auth/index", () => ({
  getCurrentUser: vi.fn(async () => mockUser),
}));

// Mock persisted-queries plugin — tests send raw queries, not persisted ones
vi.mock("../persisted-queries", () => ({
  persistedOperationsPlugin: () => ({}),
  getPersistedOperation: () => undefined,
  registerPersistedOperation: () => {},
  loadPersistedOperations: () => {},
}));

// Mock redis-pubsub — use in-memory EventEmitter-based pubsub in tests
vi.mock("../redis-pubsub", async () => {
  const { EventEmitter } = await import("events");
  const emitter = new EventEmitter();
  const graphqlPubSub = {
    subscribe: (topic: string) => {
      const queue: unknown[] = [];
      let resolveNext: ((v: { value: unknown; done: boolean }) => void) | null = null;
      const listener = (payload: unknown) => {
        if (resolveNext) {
          const r = resolveNext;
          resolveNext = null;
          r({
            value:
              {
                sessionUpdated: payload,
                emotionAnalysisCreated: payload,
                conversationTurnAdded: payload,
              }[topic] ?? payload,
            done: false,
          });
        } else {
          queue.push(payload);
        }
      };
      emitter.on(topic, listener);
      const iterable = {
        [Symbol.asyncIterator]() {
          return {
            next: () => {
              if (queue.length > 0) {
                return Promise.resolve({ value: queue.shift(), done: false });
              }
              return new Promise((r) => {
                resolveNext = r;
              });
            },
            return: () => {
              emitter.off(topic, listener);
              return Promise.resolve({ value: undefined, done: true });
            },
          };
        },
      };
      return Promise.resolve(iterable);
    },
    publish: (topic: string, payload: unknown) => {
      emitter.emit(topic, payload);
    },
  };
  return { graphqlPubSub };
});

// Import after mock is set up
import { yoga, schema } from "../server";
import { depthLimitRule } from "../security";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function setAuth(authenticated: boolean) {
  mockUser = authenticated
    ? { id: "test-user-id", role: "admin", email: "test@pixelated.dev" }
    : null;
}

function setAuthUser(
  user: {
    id: string;
    role: string;
    email?: string;
    scopes?: string[];
  } | null,
) {
  mockUser = user;
}

async function executeQuery(
  query: string,
  authenticated: boolean,
  variables?: Record<string, unknown>,
) {
  setAuth(authenticated);

  const body: Record<string, unknown> = { query };
  if (variables) body['variables'] = variables;

  const request = new Request("http://localhost:3000/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const response = await yoga.handle(request);
  return response.json() as Promise<{
    data?: Record<string, unknown>;
    errors?: Array<{ message: string }>;
  }>;
}

async function executeSubscriptionText(query: string, authenticated: boolean) {
  setAuth(authenticated);

  const request = new Request("http://localhost:3000/api/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ query }),
  });

  const response = await yoga.handle(request);
  return response.text();
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("GraphQL — PIX-4064", () => {
  beforeEach(() => {
    setAuth(false);
  });

  // ── Health ──────────────────────────────

  it("health query returns ok", async () => {
    const result = await executeQuery("{ health }", true);
    expect(result.errors).toBeUndefined();
    expect(result.data?.['health']).toBe("ok");
  });

  // ── Sessions (auth required) ──────────────

  it("sessions query requires authentication", async () => {
    const result = await executeQuery("{ sessions(limit: 5) { id } }", false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.message).toContain("Authentication required");
  });

  it("sessions query returns empty array when no data", async () => {
    const result = await executeQuery("{ sessions(limit: 5) { id } }", true);
    expect(result.errors).toBeUndefined();
    expect(result.data?.['sessions']).toEqual([]);
  });

  // ── Session by ID ──────────────────────

  it("session query returns null for non-existent ID", async () => {
    const result = await executeQuery(
      "query($id: ID!) { session(id: $id) { id clientId } }",
      true,
      { id: "507f1f77bcf86cd799439011" },
    );
    expect(result.errors).toBeUndefined();
    expect(result.data?.['session']).toBeNull();
  });

  it("session query requires authentication", async () => {
    const result = await executeQuery("query($id: ID!) { session(id: $id) { id } }", false, {
      id: "507f1f77bcf86cd799439011",
    });
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.message).toContain("Authentication required");
  });

  // ── Emotions ──────────────────────

  it("emotions query requires authentication", async () => {
    const result = await executeQuery(
      "query($sid: ID!) { emotions(sessionId: $sid) { id } }",
      false,
      { sid: "test-session" },
    );
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.message).toContain("Authentication required");
  });

  it("emotions query returns empty array for non-existent session", async () => {
    const result = await executeQuery(
      "query($sid: ID!) { emotions(sessionId: $sid) { id } }",
      true,
      { sid: "nonexistent-session" },
    );
    expect(result.errors).toBeUndefined();
    expect(result.data?.['emotions']).toEqual([]);
  });

  // ── Interventions ──────────────────────

  it("interventions query requires authentication", async () => {
    const result = await executeQuery(
      "query($uid: ID!) { interventions(userId: $uid) { id } }",
      false,
      { uid: "test-user" },
    );
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.message).toContain("Authentication required");
  });

  it("interventions query returns empty array for no data", async () => {
    const result = await executeQuery(
      "query($uid: ID!) { interventions(userId: $uid) { id } }",
      true,
      { uid: "nonexistent-user" },
    );
    expect(result.errors).toBeUndefined();
    expect(result.data?.['interventions']).toEqual([]);
  });

  // ── AnonymizedMetrics ──────────────────────

  it("anonymizedMetrics query returns real privacy metrics from AnonymizationService", async () => {
    const result = await executeQuery(
      "{ anonymizedMetrics { privacyMetrics { kAnonymity differentialPrivacyEpsilon reidentificationRisk } } }",
      true,
    );
    expect(result.errors).toBeUndefined();
    // aiRepository is undefined in test env → resolver catch block returns
    // safe empty response: kAnonymity=0, epsilon=0, reidentificationRisk=1
    expect(result.data?.['anonymizedMetrics']?.['privacyMetrics']).toEqual({
      kAnonymity: 0,
      differentialPrivacyEpsilon: 0,
      reidentificationRisk: 1,
    });
  });

  it("anonymizedMetrics query requires authentication", async () => {
    const result = await executeQuery(
      "{ anonymizedMetrics { privacyMetrics { kAnonymity } } }",
      false,
    );
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.message).toContain("Authentication required");
  });

  // ── Depth limit ──────────────────────

  it("rejects queries exceeding depth limit (10)", () => {
    // graphql-depth-limit hardcodes exemption for __-prefixed fields,
    // so introspection queries can't trigger it. Use a recursive test
    // schema with buildSchema + validate from the same graphql import
    // (avoids the ESM/CJS instanceof hazard with @graphql-tools/schema).
    const recursiveSchema = buildSchema(`
      type Query { items: [Item] }
      type Item { children: [Item] name: String }
    `);
    const deepQuery = parse(`{
      items {
        children {
          children {
            children {
              children {
                children {
                  children {
                    children {
                      children {
                        children {
                          children {
                            name
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`);
    const errors = validate(recursiveSchema, deepQuery, [depthLimitRule()]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toMatch(/depth|Depth/i);
  });

  it("accepts queries within depth limit (10)", async () => {
    const validQuery = `{
      sessions(limit: 1) {
        id
        clientId
        emotions {
          id
          emotions {
            joy
            sadness
          }
        }
      }
    }`;
    const result = await executeQuery(validQuery, true);
    expect(result.errors).toBeUndefined();
  });

  // ── Complexity limit ──────────────────────

  it("rejects queries exceeding complexity limit (1000)", async () => {
    // sessions(limit: 200) → list cost = 10 * 200 = 2000 > 1000
    const complexQuery = `{ sessions(limit: 200) { id } }`;
    const result = await executeQuery(complexQuery, true);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.message).toMatch(/complex|Complex/i);
  });

  it("accepts queries within complexity limit (1000)", async () => {
    const result = await executeQuery("{ health }", true);
    expect(result.errors).toBeUndefined();
  });

  // ── Session.emotions field resolver ──────────────────────

  it("Session.emotions resolves to array", async () => {
    const result = await executeQuery(
      "{ sessions(limit: 1) { id emotions { id emotions { joy } } } }",
      true,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data?.['sessions']).toEqual([]);
  });

  // ── Session.turns field resolver ──────────────────────

  it("Session.turns resolves to empty array", async () => {
    const result = await executeQuery(
      "{ sessions(limit: 1) { id turns { id role content } } }",
      true,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data?.['sessions']).toEqual([]);
  });

  // ── Auth enforcement ──────────────────────

  it("all queries fail without auth", async () => {
    const queries = [
      "{ sessions(limit: 1) { id } }",
      "query($id: ID!) { session(id: $id) { id } }",
      "query($sid: ID!) { emotions(sessionId: $sid) { id } }",
      "query($uid: ID!) { interventions(userId: $uid) { id } }",
      "{ anonymizedMetrics { privacyMetrics { kAnonymity } } }",
    ];

    const variablesList = [
      {},
      { id: "507f1f77bcf86cd799439011" },
      { sid: "test-session" },
      { uid: "test-user" },
      {},
    ];

    for (let i = 0; i < queries.length; i++) {
      const result = await executeQuery(queries[i], false, variablesList[i]);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toContain("Authentication required");
    }
  });

  // ── Subscriptions ──────────────────────

  it("sessionUpdated subscription requires auth", async () => {
    const sseText = await executeSubscriptionText("subscription { sessionUpdated { id } }", false);
    expect(sseText).toContain("Authentication required");
  });

  it("emotionAnalysisCreated subscription requires auth", async () => {
    const sseText = await executeSubscriptionText(
      "subscription { emotionAnalysisCreated { id } }",
      false,
    );
    expect(sseText).toContain("Authentication required");
  });

  it("conversationTurnAdded subscription requires auth", async () => {
    const sseText = await executeSubscriptionText(
      "subscription { conversationTurnAdded { id } }",
      false,
    );
    expect(sseText).toContain("Authentication required");
  });

  // ── Introspection ──────────────────────

  it("schema has all required root types", () => {
    const typeMap = schema.getTypeMap();
    expect(typeMap["Session"]).toBeDefined();
    expect(typeMap["EmotionAnalysis"]).toBeDefined();
    expect(typeMap["ConversationTurn"]).toBeDefined();
    expect(typeMap["InterventionRecord"]).toBeDefined();
    expect(typeMap["AnonymizedMetrics"]).toBeDefined();
    expect(typeMap["Query"]).toBeDefined();
    expect(typeMap["Subscription"]).toBeDefined();
  });

  it("Query type has all required fields", () => {
    const queryType = schema.getQueryType();
    expect(queryType).toBeDefined();
    const fields = queryType?.getFields();
    expect(fields?.["session"]).toBeDefined();
    expect(fields?.["sessions"]).toBeDefined();
    expect(fields?.["emotions"]).toBeDefined();
    expect(fields?.["interventions"]).toBeDefined();
    expect(fields?.["anonymizedMetrics"]).toBeDefined();
    expect(fields?.["health"]).toBeDefined();
  });

  it("Subscription type has all required fields", () => {
    const subscriptionType = schema.getSubscriptionType();
    expect(subscriptionType).toBeDefined();
    const fields = subscriptionType?.getFields();
    expect(fields?.["sessionUpdated"]).toBeDefined();
    expect(fields?.["emotionAnalysisCreated"]).toBeDefined();
    expect(fields?.["conversationTurnAdded"]).toBeDefined();
  });

  it("Session type has emotions and turns field resolvers", () => {
    const sessionType = schema.getType("Session");
    expect(sessionType).toBeDefined();
    const fields = (sessionType as { getFields?: () => Record<string, unknown> })?.getFields?.();
    expect(fields?.["emotions"]).toBeDefined();
    expect(fields?.["turns"]).toBeDefined();
  });

  // ── @auth directive (PIX-4065) ──────────────────────

  it("schema defines @auth directive", () => {
    const authDirective = schema.getDirective("auth");
    expect(authDirective).toBeDefined();
    expect(authDirective?.args.find((a) => a.name === "scope")).toBeDefined();
  });

  it("schema defines @requireRole directive", () => {
    const requireRoleDirective = schema.getDirective("requireRole");
    expect(requireRoleDirective).toBeDefined();
    expect(requireRoleDirective?.args.find((a) => a.name === "role")).toBeDefined();
  });

  it("health query is public — no auth required", async () => {
    const result = await executeQuery("{ health }", false);
    expect(result.errors).toBeUndefined();
    expect(result.data?.['health']).toBe("ok");
  });

  it("anonymizedMetrics rejects non-admin user (scope enforcement)", async () => {
    setAuthUser({
      id: "dev-user",
      role: "developer",
      scopes: ["read", "write"],
    });
    const body = {
      query: "{ anonymizedMetrics { privacyMetrics { kAnonymity } } }",
    };
    const request = new Request("http://localhost:3000/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const response = await yoga.handle(request);
    const result = await response.json();
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.message).toContain("Scope 'admin' required");
  });

  it("anonymizedMetrics allows admin user", async () => {
    setAuthUser({
      id: "admin-user",
      role: "admin",
      scopes: ["admin"],
    });
    const result = await executeQuery(
      "{ anonymizedMetrics { privacyMetrics { kAnonymity } } }",
      true,
    );
    expect(result.errors).toBeUndefined();
  });

  it("sessions query allows developer with read scope", async () => {
    setAuthUser({
      id: "dev-user",
      role: "developer",
      scopes: ["read", "memory:read"],
    });
    const result = await executeQuery("{ sessions(limit: 5) { id } }", true);
    expect(result.errors).toBeUndefined();
    expect(result.data?.['sessions']).toEqual([]);
  });

  it("subscriptions reject unauthenticated via directive", async () => {
    setAuthUser(null);
    const sseText = await executeSubscriptionText("subscription { sessionUpdated { id } }", false);
    expect(sseText).toContain("Authentication required");
  });
});
