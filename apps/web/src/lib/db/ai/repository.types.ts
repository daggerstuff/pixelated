/**
 * AI repository types and serialization helpers.
 * Extracted from repository.ts.
 */

import type { EmotionAnalysis } from "../../ai/emotions/types";
import type { Collection, Db } from "mongodb";
export interface EmotionData {
  type: string;
  intensity: number;
  timestamp: Date;
  context?: string;
}

import type { TherapySession } from "../../ai/models/ai-types";
import type {
  AIUsageStats,
  CrisisDetectionResult,
  InterventionAnalysisResult,
  ResponseGenerationResult,
  SentimentAnalysisResult,
} from "./types";
export type DatabaseObjectId = { toHexString(): string; toString(): string };
export type DatabaseObjectIdCtor = (id?: string) => DatabaseObjectId;

export interface MongoBridge {
  connect: () => Promise<Db>;
  getDb: () => Db;
}

export type StoredDocument<T> = Omit<T, "id"> & { _id?: DatabaseObjectId };
export type EmotionDataDocument = EmotionData & { _id?: DatabaseObjectId };
export type EmotionAnalysisDocument = EmotionAnalysis & { _id?: DatabaseObjectId };
export type TherapyClientRelationship = { therapistId: string; clientId: string };
export type EmotionCorrelationDocument = Record<string, unknown> & {
  _id?: DatabaseObjectId;
  emotion1: string;
  emotion2: string;
  correlation: number;
};

let mongodb: MongoBridge | null = null;
let ObjectId: DatabaseObjectIdCtor | undefined;

if (typeof window === "undefined") {
  // Server side - import real MongoDB dependencies
  void (async () => {
    try {
      const configModule = await import("../../../config/mongodb.config");
      mongodb = configModule.default;
      const mongodbLib = await import("mongodb");
      ObjectId = (id?: string) => new mongodbLib.ObjectId(id);
    } catch {
      // Fallback if MongoDB is not available
      mongodb = null;
      ObjectId = (id?: string) => {
        const value = id ?? "mock-object-id";
        return {
          toString() {
            return value;
          },
          toHexString() {
            return value;
          },
        };
      };
    }
  })();
} else {
  // Client side - use mocks
  mongodb = null;
    ObjectId = (id?: string) => {
      const value = id ?? "mock-object-id";
      return {
        toString() {
          return value;
        },
        toHexString() {
          return value;
        },
      };
    };
}
// Service interfaces defined ahead of implementation. These describe the
// shape of feedback data the AI services will produce; concrete service
// classes should be created when the corresponding analytics features land.
export interface EfficacyFeedback {
  recommendationId: string;
  clientId: string;
  techniqueId: string;
  efficacyRating: number;
  timestamp: string | Date;
  feedback: string;
  sessionId: string;
  therapistId: string;
  context: Record<string, unknown>;
}

export interface Technique {
  id: string;
  name: string;
  description: string;
  indication: string;
  category: string;
}

export interface ClientProfile {
  preferences?: Record<string, unknown>;
  characteristics?: Record<string, unknown>;
  demographic?: Record<string, unknown>;
  history?: {
    pastTechniques: PastTechnique[];
  };
}

export interface PastTechnique {
  techniqueId: string;
  techniqueName: string;
  lastUsed: Date;
  efficacy: number;
  usageCount: number;
}

export interface BiasAnalysisResult {
  id: string;
  sessionId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  overallBiasScore: number;
  alertLevel: string;
  confidenceScore: number;
  layerResults: Record<string, unknown>;
  demographics: Record<string, unknown>;
  demographicGroups: Record<string, unknown>;
  recommendations: string[];
  explanation: string;
  latencyMs: number;
  modelId: string;
  modelProvider: string;
  metadata: Record<string, unknown>;
}

export interface BiasMetric {
  id: string;
  metricType: string;
  metricName: string;
  metricValue: number;
  sessionId?: string;
  userId?: string;
  timestamp: Date;
  aggregationPeriod: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface BiasAlert {
  id: string;
  alertId: string;
  sessionId?: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
  alertType: string;
  alertLevel: string;
  message: string;
  details: Record<string, unknown>;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date | null;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date | null;
  actions: unknown[];
  notificationChannels: string[];
  escalated: boolean;
  escalatedAt?: Date | null;
}

export interface AlertAction {
  type: string;
  timestamp: Date;
  userId: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface BiasAlertDistribution {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export interface BiasAggregatedMetrics {
  totalAnalyses: number;
  averageBiasScore: number;
  alertCounts: BiasAlertDistribution;
  demographics: Record<string, unknown>;
}

export interface BiasTrendAnalysis {
  periodType: "daily" | "weekly" | "monthly";
  trends: Array<{
    period: string;
    biasScore: number;
    alertCount: number;
    sessionCount: number;
  }>;
}

export interface BiasCustomAnalysis {
  analysisType: string;
  parameters: Record<string, unknown>;
  results: Record<string, unknown>;
}

export interface BiasRecommendations {
  priority: "low" | "medium" | "high" | "critical";
  recommendations: Array<{
    type: string;
    description: string;
    actionItems: string[];
    timeline: string;
  }>;
}

export interface BiasReport {
  id: string;
  reportId: string;
  userId?: string;
  title: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  timeRangeStart: Date;
  timeRangeEnd: Date;
  sessionCount: number;
  format: "json" | "pdf" | "html" | "csv";
  overallFairnessScore?: number;
  averageBiasScore?: number;
  alertDistribution?: BiasAlertDistribution;
  aggregatedMetrics?: BiasAggregatedMetrics;
  trendAnalysis?: BiasTrendAnalysis;
  customAnalysis?: BiasCustomAnalysis;
  recommendations?: BiasRecommendations;
  executionTimeMs?: number;
  filePath?: string;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown>;
}

/**
 * Fields allowed in particle interaction analytics data to prevent PII leakage
 */
const ALLOWED_PARTICLE_INTERACTION_FIELDS = new Set([
  // Interaction metadata
  "interactionType",
  "action",
  "component",
  "elementId",
  "elementType",
  // Timing metrics
  "duration",
  "latency",
  "responseTime",
  "loadTime",
  // UI/UX metrics
  "scrollDepth",
  "clickCount",
  "hoverDuration",
  "viewportVisible",
  // Feature flags
  "featureEnabled",
  "variant",
  "experimentId",
  // Performance metrics
  "fps",
  "memoryUsage",
  "networkLatency",
  // Session context (non-PII)
  "pageUrl",
  "referrer",
  "deviceType",
  "browserType",
  "osType",
  // Analytics counts
  "count",
  "value",
  "score",
  "rating",
  // Error tracking (non-sensitive)
  "errorType",
  "errorCode",
  "severity",
]);

/**
 * Sanitize particle interaction data to only include analytics-relevant fields.
 * This prevents PII or sensitive data from being stored in the database.
 */
export function sanitizeParticleInteractionData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    // Only include fields that are in the allowed list
    if (ALLOWED_PARTICLE_INTERACTION_FIELDS.has(key)) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Repository for AI analysis results
 */
