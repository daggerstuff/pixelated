/**
 * GraphQL Resolvers — PIX-4064
 *
 * Data sources:
 * - AIRepository (MongoDB): sessions, emotions, interventions
 * - InterventionAnalysisService (in-memory): analysis history (future wiring)
 * - Research platform: anonymized metrics (future wiring)
 * - Conversation turns: in-memory only — returns empty array (TODO: wire to conversation service)
 *
 * Auth context:
 * - Uses `getCurrentUser` from `@/lib/auth/index` (dual-mode: JWT or API key)
 * - Resolvers check `context.user` for authenticated access
 */

import { aiRepository } from "@/lib/db/ai";
import type { TherapySession } from "@/lib/ai/models/ai-types";
import type { EmotionAnalysis } from "@/lib/ai/emotions/types";
import type { InterventionAnalysisResult } from "@/lib/db/ai/types";
import type { ConversationTurn } from "@/lib/pixel-conversation-integration";
import { graphqlPubSub } from "./redis-pubsub";
import { resolveAnonymizedMetrics } from "./anonymized-metrics";
import { createBuildSafeLogger } from "@/lib/logging/build-safe-logger";

const logger = createBuildSafeLogger("graphql-resolvers");

// ──────────────────────────────────────────────
// Context type
// ──────────────────────────────────────────────

export interface GraphqlContext {
  user: {
    id: string;
    role: string;
    email?: string;
    /** API-key scopes (empty for JWT users) — used by @auth(scope) directive */
    scopes?: string[];
  } | null;
  request: Request;
}

// ──────────────────────────────────────────────
// Helper: check auth
// ──────────────────────────────────────────────

function requireAuth(context: GraphqlContext): void {
  if (!context.user) {
    throw new Error("Authentication required");
  }
}

// ──────────────────────────────────────────────
// Date serialization helpers
// ──────────────────────────────────────────────

function toISO(value: Date | string | undefined | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

// ──────────────────────────────────────────────
// Session mappers
// ──────────────────────────────────────────────

function mapSession(raw: TherapySession & { _id?: unknown }): NonNullable<GraphqlSession> {
  const id =
    ((raw as Record<string, unknown>)['sessionId'] as string | undefined) ??
    ((raw as Record<string, unknown>)['_id']?.toString?.() ?? "");
  return {
    id,
    clientId: raw.clientId,
    therapistId: raw.therapistId ?? null,
    startTime: toISO(raw.startTime) ?? "",
    endTime: toISO(raw.endTime) ?? "",
    sessionType: raw.sessionType?.toUpperCase() ?? null,
    status: raw.status?.toUpperCase() ?? null,
    notes: raw.notes ?? null,
    transcript: raw.transcript ?? null,
    metadata: (raw.metadata as Record<string, unknown> | null) ?? null,
    aiAnalysis: raw.aiAnalysis
      ? {
          emotionalState: raw.aiAnalysis.emotionalState,
          techniques: raw.aiAnalysis.techniques,
          recommendations: raw.aiAnalysis.recommendations,
          riskAssessment: raw.aiAnalysis.riskAssessment.toUpperCase(),
        }
      : null,
  };
}

interface GraphqlSession {
  id: string;
  clientId: string;
  therapistId: string | null;
  startTime: string;
  endTime: string;
  sessionType: string | null;
  status: string | null;
  notes: string | null;
  transcript: string | null;
  metadata: Record<string, unknown> | null;
  aiAnalysis: {
    emotionalState: string[];
    techniques: string[];
    recommendations: string[];
    riskAssessment: string;
  } | null;
}

// ──────────────────────────────────────────────
// Emotion mappers
// ──────────────────────────────────────────────

function mapEmotion(raw: EmotionAnalysis): Record<string, unknown> {
  return {
    id: raw.id,
    sessionId: raw.sessionId,
    timestamp: raw.timestamp,
    emotions: raw.emotions,
    dimensions: raw.dimensions,
    confidence: raw.confidence,
    metadata: raw.metadata
      ? {
          source: raw.metadata.source.toUpperCase(),
          processingTime: raw.metadata.processingTime,
          modelVersion: raw.metadata.modelVersion,
          confidence: raw.metadata.confidence,
        }
      : null,
  };
}

// ──────────────────────────────────────────────
// Intervention mappers
// ──────────────────────────────────────────────

function mapIntervention(
  raw: InterventionAnalysisResult & { _id?: unknown },
): Record<string, unknown> {
  const id = raw.id ?? (raw._id?.toString?.() ?? "");
  return {
    id,
    userId: raw.userId,
    conversation: raw.conversation,
    intervention: raw.intervention,
    userResponse: raw.userResponse,
    effectiveness: raw.effectiveness,
    insights: raw.insights,
    recommendedFollowUp: raw.recommendedFollowUp,
    metadata: raw.metadata,
    createdAt: toISO(raw.createdAt),
    updatedAt: toISO(raw.updatedAt),
    modelId: raw.modelId,
    modelProvider: raw.modelProvider,
  };
}

// ──────────────────────────────────────────────
// Resolver map
// ──────────────────────────────────────────────

export const resolvers = {
  // ── Scalars ──────────────────────────────

  JSON: {
    serialize: (value: unknown) => value,
    parseValue: (value: unknown) => value,
    parseLiteral: (_ast: { kind: string; value?: unknown }) => {
      // Minimal JSON literal parsing — graphql-yoga provides JSON scalar by default
      return null;
    },
  },

  DateTime: {
    serialize: (value: unknown): string => {
      if (value instanceof Date) return value.toISOString();
      if (typeof value === "string") return value;
      return String(value);
    },
    parseValue: (value: unknown): Date => {
      if (value instanceof Date) return value;
      if (typeof value === "string") return new Date(value);
      throw new Error("Invalid DateTime value");
    },
    parseLiteral: (ast: { kind: string; value?: string }) => {
      if (ast.kind === "StringValue" && ast.value) {
        return new Date(ast.value);
      }
      throw new Error("Invalid DateTime literal");
    },
  },

  // ── Session field resolvers ──────────────

  Session: {
    emotions: async (parent: GraphqlSession, _args: unknown, context: GraphqlContext) => {
      requireAuth(context);
      try {
        const results = await aiRepository.getEmotionsForSession(parent.id);
        return results.map(mapEmotion);
      } catch (err) {
        logger.error("Failed to fetch emotions for session", {
          sessionId: parent.id,
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }
    },

    turns: async (_parent: GraphqlSession, _args: unknown, context: GraphqlContext) => {
      requireAuth(context);
      // Conversation turns are in-memory only — no DB store exists yet.
      // TODO: Wire to conversation service when available.
      return [] as ConversationTurn[];
    },
  },

  // ── Query ────────────────────────────────

  Query: {
    health: () => "ok",

    session: async (_parent: unknown, args: { id: string }, context: GraphqlContext) => {
      requireAuth(context);
      try {
        const sessions = await aiRepository.getSessionsByIds([args.id]);
        if (sessions.length === 0) return null;
        return mapSession(sessions[0]);
      } catch (err) {
        logger.error("Failed to fetch session", {
          id: args.id,
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
    },

    sessions: async (
      _parent: unknown,
      args: {
        clientId?: string;
        therapistId?: string;
        status?: string;
        startDate?: string;
        endDate?: string;
        limit?: number;
        offset?: number;
      },
      context: GraphqlContext,
    ) => {
      requireAuth(context);
      try {
        // Non-admin users can only see their own sessions or sessions they're the therapist for
        const filter: {
          clientId?: string;
          therapistId?: string;
          startDate?: Date;
          endDate?: Date;
          status?: string;
        } = {};

        if (args.clientId) filter.clientId = args.clientId;
        if (args.therapistId) filter.therapistId = args.therapistId;
        if (args.status) filter.status = args.status.toLowerCase();
        if (args.startDate) filter.startDate = new Date(args.startDate);
        if (args.endDate) filter.endDate = new Date(args.endDate);

        // If non-admin and no clientId/therapistId filter, default to user as therapist
        if (
          context.user &&
          context.user.role !== "admin" &&
          !filter.clientId &&
          !filter.therapistId
        ) {
          filter.therapistId = context.user.id;
        }

        const sessions = await aiRepository.getSessions(filter);
        const offset = args.offset ?? 0;
        const limit = args.limit ?? 50;

        return sessions
          .slice(offset, offset + limit)
          .map((s) => mapSession(s as TherapySession & { _id?: unknown }));
      } catch (err) {
        logger.error("Failed to fetch sessions", {
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }
    },

    emotions: async (_parent: unknown, args: { sessionId: string }, context: GraphqlContext) => {
      requireAuth(context);
      try {
        const results = await aiRepository.getEmotionsForSession(args.sessionId);
        return results.map(mapEmotion);
      } catch (err) {
        logger.error("Failed to fetch emotions", {
          sessionId: args.sessionId,
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }
    },

    interventions: async (
      _parent: unknown,
      args: { userId: string; limit?: number; offset?: number },
      context: GraphqlContext,
    ) => {
      requireAuth(context);
      try {
        // Non-admin users can only see their own interventions
        const targetUserId =
          context.user && context.user.role !== "admin" && args.userId !== context.user.id
            ? context.user.id
            : args.userId;

        const results = await aiRepository.getInterventionAnalysisByUser(
          targetUserId,
          args.limit ?? 10,
          args.offset ?? 0,
        );
        return results.map((r) =>
          mapIntervention(r as InterventionAnalysisResult & { _id?: unknown }),
        );
      } catch (err) {
        logger.error("Failed to fetch interventions", {
          userId: args.userId,
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }
    },

    anonymizedMetrics: async (_parent: unknown, _args: unknown, context: GraphqlContext) => {
      return resolveAnonymizedMetrics(_parent, _args, context);
    },
  },

  // ── Subscription ────────────────────────

  Subscription: {
    sessionUpdated: {
      subscribe: async (
        _parent: unknown,
        _args: { sessionId?: string },
        context: GraphqlContext,
      ) => {
        requireAuth(context);
        return graphqlPubSub.subscribe("sessionUpdated");
      },
    },

    emotionAnalysisCreated: {
      subscribe: async (
        _parent: unknown,
        _args: { sessionId?: string },
        context: GraphqlContext,
      ) => {
        requireAuth(context);
        return graphqlPubSub.subscribe("emotionAnalysisCreated");
      },
    },

    conversationTurnAdded: {
      subscribe: async (
        _parent: unknown,
        _args: { sessionId?: string },
        context: GraphqlContext,
      ) => {
        requireAuth(context);
        return graphqlPubSub.subscribe("conversationTurnAdded");
      },
    },
  },
};
