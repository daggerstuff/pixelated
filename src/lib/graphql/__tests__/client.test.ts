/**
 * GraphQL SDK Client Tests — PIX-4066
 *
 * Tests the type-safe generated SDK client using mocked fetch responses.
 * Verifies: query operations, type safety, auth header injection, error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { createGraphqlClient } from "../client";
import type {
  HealthQuery,
  GetSessionQuery,
  ListSessionsQuery,
  GetEmotionsQuery,
  GetInterventionsQuery,
  GetAnonymizedMetricsQuery,
  GetSessionEmotionsQuery,
  GetSessionTurnsQuery,
} from "../generated/types";

// ── Mock fetch ──────────────────────────────────────────

let mockFetch: ReturnType<typeof vi.fn>;

function setupMockFetch(responseData: unknown, status = 200) {
  mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(responseData),
    text: () => Promise.resolve(JSON.stringify(responseData)),
  });
}

beforeEach(() => {
  vi.stubEnv("VITEST", "true");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("GraphqlSDK Client", () => {
  describe("createGraphqlClient", () => {
    it("creates client with API key auth", () => {
      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
        apiKey: "pk_test_key",
      });
      expect(client).toBeDefined();
      expect(client.health).toBeInstanceOf(Function);
      expect(client.getSession).toBeInstanceOf(Function);
      expect(client.listSessions).toBeInstanceOf(Function);
      expect(client.getEmotions).toBeInstanceOf(Function);
      expect(client.getInterventions).toBeInstanceOf(Function);
      expect(client.getAnonymizedMetrics).toBeInstanceOf(Function);
      expect(client.subscriptions).toBeDefined();
    });

    it("creates client with JWT auth", () => {
      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
        jwt: "eyJhbGci...",
      });
      expect(client).toBeDefined();
    });

    it("creates client with no auth (public queries only)", () => {
      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
      });
      expect(client).toBeDefined();
    });
  });

  describe("health query", () => {
    it("sends health query and returns typed result", async () => {
      const mockResponse: HealthQuery = { __typename: "Query", health: "ok" };
      setupMockFetch({ data: mockResponse });

      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
        apiKey: "pk_test",
        fetch: mockFetch as unknown as typeof fetch,
      });

      const result = await client.health();
      expect(result.health).toBe("ok");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify request body contains the health query
      const callArgs = mockFetch.mock.calls[0];
      const requestInit = callArgs[1] as RequestInit;
      const body = JSON.parse(requestInit.body as string);
      expect(body.query).toContain("query Health");
      expect(body.query).toContain("health");
    });
  });

  describe("getSession query", () => {
    it("sends getSession query with variables and returns typed result", async () => {
      const mockResponse: GetSessionQuery = {
        __typename: "Query",
        session: {
          __typename: "Session",
          id: "sess-123",
          clientId: "client-456",
          therapistId: "therapist-789",
          startTime: "2026-07-22T10:00:00Z",
          endTime: "2026-07-22T11:00:00Z",
          sessionType: "INDIVIDUAL",
          status: "COMPLETED",
          notes: "Session notes",
          transcript: null,
          aiAnalysis: null,
        },
      };
      setupMockFetch({ data: mockResponse });

      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
        apiKey: "pk_test",
        fetch: mockFetch as unknown as typeof fetch,
      });

      const result = await client.getSession({ id: "sess-123" });
      expect(result.session).not.toBeNull();
      expect(result.session?.id).toBe("sess-123");
      expect(result.session?.clientId).toBe("client-456");
      expect(result.session?.sessionType).toBe("INDIVIDUAL");
      expect(result.session?.status).toBe("COMPLETED");

      // Verify variables were sent
      const callArgs = mockFetch.mock.calls[0];
      const requestInit = callArgs[1] as RequestInit;
      const body = JSON.parse(requestInit.body as string);
      expect(body.variables).toEqual({ id: "sess-123" });
    });
  });

  describe("listSessions query", () => {
    it("sends listSessions with filter variables", async () => {
      const mockResponse: ListSessionsQuery = {
        __typename: "Query",
        sessions: [
          {
            __typename: "Session",
            id: "sess-1",
            clientId: "client-1",
            therapistId: null,
            startTime: "2026-07-22T10:00:00Z",
            endTime: "2026-07-22T11:00:00Z",
            sessionType: "INDIVIDUAL",
            status: "COMPLETED",
            notes: null,
          },
        ],
      };
      setupMockFetch({ data: mockResponse });

      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
        apiKey: "pk_test",
        fetch: mockFetch as unknown as typeof fetch,
      });

      const result = await client.listSessions({
        status: "COMPLETED",
        limit: 10,
        offset: 0,
      });
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].id).toBe("sess-1");

      const callArgs = mockFetch.mock.calls[0];
      const requestInit = callArgs[1] as RequestInit;
      const body = JSON.parse(requestInit.body as string);
      expect(body.variables.status).toBe("COMPLETED");
      expect(body.variables.limit).toBe(10);
    });

    it("sends listSessions with no variables (defaults)", async () => {
      const mockResponse: ListSessionsQuery = {
        __typename: "Query",
        sessions: [],
      };
      setupMockFetch({ data: mockResponse });

      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
        apiKey: "pk_test",
        fetch: mockFetch as unknown as typeof fetch,
      });

      const result = await client.listSessions();
      expect(result.sessions).toEqual([]);
    });
  });

  describe("getEmotions query", () => {
    it("returns typed EmotionAnalysis array", async () => {
      const mockResponse: GetEmotionsQuery = {
        __typename: "Query",
        emotions: [
          {
            __typename: "EmotionAnalysis",
            id: "emo-1",
            sessionId: "sess-1",
            timestamp: "2026-07-22T10:05:00Z",
            confidence: 0.95,
            emotions: {
              __typename: "EmotionVector",
              joy: 0.8,
              sadness: 0.1,
              anger: 0.05,
              fear: 0.02,
              surprise: 0.3,
              disgust: 0.01,
              trust: 0.7,
              anticipation: 0.4,
            },
            dimensions: {
              __typename: "EmotionDimensions",
              valence: 0.6,
              arousal: 0.4,
              dominance: 0.5,
            },
            metadata: null,
          },
        ],
      };
      setupMockFetch({ data: mockResponse });

      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
        apiKey: "pk_test",
        fetch: mockFetch as unknown as typeof fetch,
      });

      const result = await client.getEmotions({ sessionId: "sess-1" });
      expect(result.emotions).toHaveLength(1);
      expect(result.emotions[0].emotions.joy).toBe(0.8);
      expect(result.emotions[0].dimensions.valence).toBe(0.6);
    });
  });

  describe("getInterventions query", () => {
    it("returns typed InterventionRecord array", async () => {
      const mockResponse: GetInterventionsQuery = {
        __typename: "Query",
        interventions: [
          {
            __typename: "InterventionRecord",
            id: "int-1",
            userId: "user-1",
            conversation: "Conversation text",
            intervention: "Cognitive reframing",
            userResponse: "Patient response",
            effectiveness: 0.75,
            insights: "Good progress",
            recommendedFollowUp: "Continue CBT",
            modelId: "gpt-4",
            modelProvider: "openai",
            createdAt: "2026-07-22T10:00:00Z",
            updatedAt: "2026-07-22T10:00:00Z",
          },
        ],
      };
      setupMockFetch({ data: mockResponse });

      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
        apiKey: "pk_test",
        fetch: mockFetch as unknown as typeof fetch,
      });

      const result = await client.getInterventions({
        userId: "user-1",
        limit: 10,
      });
      expect(result.interventions).toHaveLength(1);
      expect(result.interventions[0].effectiveness).toBe(0.75);
    });
  });

  describe("getAnonymizedMetrics query", () => {
    it("returns typed AnonymizedMetrics", async () => {
      const mockResponse: GetAnonymizedMetricsQuery = {
        __typename: "Query",
        anonymizedMetrics: {
          __typename: "AnonymizedMetrics",
          aggregateEmotionScores: { joy: { mean: 0.6 } },
          techniqueEffectiveness: { cbt: { mean: 0.75 } },
          demographicBreakdown: { "18-25": { count: 42, percentage: 0.3 } },
          temporalTrends: {},
          privacyMetrics: {
            __typename: "PrivacyMetrics",
            kAnonymity: 5,
            differentialPrivacyEpsilon: 0.1,
            reidentificationRisk: 0.02,
          },
        },
      };
      setupMockFetch({ data: mockResponse });

      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
        apiKey: "pk_test",
        fetch: mockFetch as unknown as typeof fetch,
      });

      const result = await client.getAnonymizedMetrics();
      expect(result.anonymizedMetrics).not.toBeNull();
      expect(result.anonymizedMetrics?.privacyMetrics.kAnonymity).toBe(5);
    });
  });

  describe("getSessionEmotions query", () => {
    it("returns session with emotions via field resolver", async () => {
      const mockResponse: GetSessionEmotionsQuery = {
        __typename: "Query",
        session: {
          __typename: "Session",
          id: "sess-1",
          emotions: [
            {
              __typename: "EmotionAnalysis",
              id: "emo-1",
              sessionId: "sess-1",
              timestamp: "2026-07-22T10:00:00Z",
              confidence: 0.9,
              emotions: {
                __typename: "EmotionVector",
                joy: 0.5,
                sadness: 0.2,
                anger: 0.1,
                fear: 0.05,
                surprise: 0.15,
                disgust: 0.02,
                trust: 0.6,
                anticipation: 0.3,
              },
              dimensions: {
                __typename: "EmotionDimensions",
                valence: 0.4,
                arousal: 0.3,
                dominance: 0.5,
              },
            },
          ],
        },
      };
      setupMockFetch({ data: mockResponse });

      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
        apiKey: "pk_test",
        fetch: mockFetch as unknown as typeof fetch,
      });

      const result = await client.getSessionEmotions({ sessionId: "sess-1" });
      expect(result.session?.emotions).toHaveLength(1);
      expect(result.session?.emotions[0].emotions.joy).toBe(0.5);
    });
  });

  describe("getSessionTurns query", () => {
    it("returns session with conversation turns", async () => {
      const mockResponse: GetSessionTurnsQuery = {
        __typename: "Query",
        session: {
          __typename: "Session",
          id: "sess-1",
          turns: [
            {
              __typename: "ConversationTurn",
              id: "turn-1",
              role: "USER" as const,
              content: "I feel anxious",
              timestamp: "2026-07-22T10:00:00Z",
            },
            {
              __typename: "ConversationTurn",
              id: "turn-2",
              role: "ASSISTANT" as const,
              content: "Can you tell me more?",
              timestamp: "2026-07-22T10:01:00Z",
            },
          ],
        },
      };
      setupMockFetch({ data: mockResponse });

      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
        apiKey: "pk_test",
        fetch: mockFetch as unknown as typeof fetch,
      });

      const result = await client.getSessionTurns({ sessionId: "sess-1" });
      expect(result.session?.turns).toHaveLength(2);
      expect(result.session?.turns[0].role).toBe("USER");
      expect(result.session?.turns[1].role).toBe("ASSISTANT");
    });
  });

  describe("auth header injection", () => {
    it("injects X-API-Key header when apiKey is set", async () => {
      setupMockFetch({ data: { __typename: "Query", health: "ok" } });

      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
        apiKey: "pk_secret_key",
        fetch: mockFetch as unknown as typeof fetch,
      });

      await client.health();

      const callArgs = mockFetch.mock.calls[0];
      const requestInit = callArgs[1] as RequestInit;
      const headers = new Headers(requestInit.headers);
      expect(headers.get("X-API-Key")).toBe("pk_secret_key");
      expect(headers.get("Authorization")).toBeNull();
    });

    it("injects Authorization Bearer header when jwt is set", async () => {
      setupMockFetch({ data: { __typename: "Query", health: "ok" } });

      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
        jwt: "eyJtoken",
        fetch: mockFetch as unknown as typeof fetch,
      });

      await client.health();

      const callArgs = mockFetch.mock.calls[0];
      const requestInit = callArgs[1] as RequestInit;
      const headers = new Headers(requestInit.headers);
      expect(headers.get("Authorization")).toBe("Bearer eyJtoken");
      expect(headers.get("X-API-Key")).toBeNull();
    });

    it("prefers API key over JWT when both are set", async () => {
      setupMockFetch({ data: { __typename: "Query", health: "ok" } });

      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
        apiKey: "pk_key",
        jwt: "jwt_token",
        fetch: mockFetch as unknown as typeof fetch,
      });

      await client.health();

      const callArgs = mockFetch.mock.calls[0];
      const requestInit = callArgs[1] as RequestInit;
      const headers = new Headers(requestInit.headers);
      expect(headers.get("X-API-Key")).toBe("pk_key");
      expect(headers.get("Authorization")).toBeNull();
    });

    it("injects custom headers", async () => {
      setupMockFetch({ data: { __typename: "Query", health: "ok" } });

      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
        apiKey: "pk_test",
        headers: { "X-Custom-Header": "custom-value" },
        fetch: mockFetch as unknown as typeof fetch,
      });

      await client.health();

      const callArgs = mockFetch.mock.calls[0];
      const requestInit = callArgs[1] as RequestInit;
      const headers = new Headers(requestInit.headers);
      expect(headers.get("X-Custom-Header")).toBe("custom-value");
    });
  });

  describe("subscriptions", () => {
    it("exposes subscription document strings", () => {
      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
        apiKey: "pk_test",
      });

      expect(client.subscriptions.sessionUpdated).toContain("subscription SessionUpdated");
      expect(client.subscriptions.emotionAnalysisCreated).toContain(
        "subscription EmotionAnalysisCreated",
      );
      expect(client.subscriptions.conversationTurnAdded).toContain(
        "subscription ConversationTurnAdded",
      );
    });

    it("subscription documents contain correct field selections", () => {
      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
      });

      expect(client.subscriptions.sessionUpdated).toContain("sessionUpdated");
      expect(client.subscriptions.sessionUpdated).toContain("sessionId: $sessionId");
      expect(client.subscriptions.emotionAnalysisCreated).toContain("emotionAnalysisCreated");
      expect(client.subscriptions.conversationTurnAdded).toContain("conversationTurnAdded");
    });
  });

  describe("error handling", () => {
    it("propagates GraphQL errors from response", async () => {
      const errorResponse = {
        errors: [{ message: "Authentication required" }],
      };
      mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(errorResponse),
        text: () => Promise.resolve(JSON.stringify(errorResponse)),
      });

      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
        fetch: mockFetch as unknown as typeof fetch,
      });

      // graphql-request throws on errors array
      await expect(client.health()).rejects.toThrow();
    });

    it("propagates HTTP error on non-200 status", async () => {
      mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ errors: [{ message: "Internal error" }] }),
        text: () => Promise.resolve(JSON.stringify({ errors: [{ message: "Internal error" }] })),
      });

      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
        fetch: mockFetch as unknown as typeof fetch,
      });

      await expect(client.health()).rejects.toThrow();
    });
  });

  describe("type re-exports", () => {
    it("generated types are importable", async () => {
      // This is a compile-time test — if imports resolve, types exist
      const { createGraphqlClient } = await import("../client");
      const client = createGraphqlClient({
        endpoint: "http://localhost:5173/api/graphql",
      });

      // Type assertions verify the SDK interface shape
      expect(typeof client.health).toBe("function");
      expect(typeof client.getSession).toBe("function");
      expect(typeof client.listSessions).toBe("function");
      expect(typeof client.getEmotions).toBe("function");
      expect(typeof client.getInterventions).toBe("function");
      expect(typeof client.getAnonymizedMetrics).toBe("function");
      expect(typeof client.getSessionEmotions).toBe("function");
      expect(typeof client.getSessionTurns).toBe("function");
      expect(typeof client.subscriptions).toBe("object");
    });
  });
});
