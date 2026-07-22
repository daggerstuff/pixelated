/**
 * AnonymizedMetrics Resolver — PIX-4064
 *
 * Wires the GraphQL `anonymizedMetrics` query to the research platform's
 * AnonymizationService with real emotion data from AIRepository (MongoDB).
 *
 * Pipeline:
 * 1. Fetch recent sessions from AIRepository
 * 2. Fetch emotion analyses for those sessions
 * 3. Transform EmotionAnalysis → ResearchDataPoint format
 * 4. Run through AnonymizationService.anonymizeResearchData() with
 *    consent gating
 * 5. Aggregate anonymized data into the GraphQL AnonymizedMetrics type
 * 6. Return with real privacy metrics (kAnonymity, epsilon, reidentificationRisk)
 *
 * Auth: Only admin role users can query anonymizedMetrics (enforced in resolver).
 * Consent: The AnonymizationService applies k-anonymity and differential
 * privacy noise. Data points with insufficient consent are excluded.
 */

import { aiRepository } from "@/lib/db/ai";
import type { EmotionAnalysis } from "@/lib/ai/emotions/types";
import type { TherapySession } from "@/lib/ai/models/ai-types";
import { AnonymizationService } from "@/lib/research/services/AnonymizationService";
import type { ResearchDataPoint } from "@/lib/research/types/research-types";
import { createBuildSafeLogger } from "@/lib/logging/build-safe-logger";

const logger = createBuildSafeLogger("graphql-anonymized-metrics");

// ──────────────────────────────────────────────
// Anonymization service instance
// ──────────────────────────────────────────────

/**
 * Singleton AnonymizationService configured with HIPAA-compliant defaults:
 * k-anonymity=5, differential privacy epsilon=0.1, noise injection enabled.
 *
 * Same configuration as the ResearchPlatform singleton uses internally.
 */
const anonymizationService = new AnonymizationService({
  kAnonymity: 5,
  epsilon: 0.1,
  delta: 0.00001,
  temporalEpsilon: 0.05,
  fieldLevelEncryption: true,
  noiseInjection: true,
});

// ──────────────────────────────────────────────
// Transform EmotionAnalysis → ResearchDataPoint
// ──────────────────────────────────────────────

/**
 * Converts EmotionAnalysis records from the AIRepository (MongoDB)
 * into ResearchDataPoint format expected by the AnonymizationService.
 *
 * Maps Plutchik 8-emotion model to the research platform's 7-emotion model:
 * joy → happiness, sadness → sadness, anger → anger, fear → fear,
 * surprise → surprise, disgust → disgust, trust+anticipation → neutral.
 */
function toResearchDataPoint(emotion: EmotionAnalysis, session: TherapySession): ResearchDataPoint {
  const emotions = emotion.emotions;
  return {
    id: emotion.id,
    clientId: session.clientId,
    sessionId: emotion.sessionId,
    timestamp: new Date(emotion.timestamp),
    emotionScores: {
      happiness: emotions.joy,
      sadness: emotions.sadness,
      anger: emotions.anger,
      fear: emotions.fear,
      surprise: emotions.surprise,
      disgust: emotions.disgust,
      neutral: (emotions.trust + emotions.anticipation) / 2,
    },
    techniqueEffectiveness: {},
    sessionDuration: session.endTime
      ? (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000
      : 0,
    therapeuticApproach: session.sessionType,
    metadata: emotion.metadata
      ? {
          source: emotion.metadata.source,
          modelVersion: emotion.metadata.modelVersion,
          confidence: emotion.confidence,
          valence: emotion.dimensions.valence,
          arousal: emotion.dimensions.arousal,
          dominance: emotion.dimensions.dominance,
        }
      : undefined,
  };
}

// ──────────────────────────────────────────────
// Aggregate anonymized data into GraphQL AnonymizedMetrics
// ──────────────────────────────────────────────

interface StatSummary {
  mean: number;
  median: number;
  stdDev: number;
  count: number;
}

function computeStats(values: number[]): StatSummary {
  if (values.length === 0) {
    return { mean: 0, median: 0, stdDev: 0, count: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return { mean, median, stdDev: Math.sqrt(variance), count: values.length };
}

function aggregateEmotionScores(dataPoints: ResearchDataPoint[]): Record<string, StatSummary> {
  const emotionKeys = ["happiness", "sadness", "anger", "fear", "surprise", "disgust", "neutral"];
  const result: Record<string, StatSummary> = {};
  for (const key of emotionKeys) {
    const values = dataPoints
      .map((dp) => dp.emotionScores[key as keyof typeof dp.emotionScores])
      .filter((v): v is number => typeof v === "number" && !isNaN(v));
    result[key] = computeStats(values);
  }
  return result;
}

function aggregateTechniqueEffectiveness(
  dataPoints: ResearchDataPoint[],
): Record<string, StatSummary & { confidenceInterval: [number, number] }> {
  const techniques = new Map<string, number[]>();
  for (const dp of dataPoints) {
    for (const [technique, score] of Object.entries(dp.techniqueEffectiveness)) {
      if (typeof score === "number" && !isNaN(score)) {
        if (!techniques.has(technique)) techniques.set(technique, []);
        techniques.get(technique)!.push(score);
      }
    }
  }
  const result: Record<string, StatSummary & { confidenceInterval: [number, number] }> = {};
  for (const [technique, values] of techniques) {
    const stats = computeStats(values);
    // 95% confidence interval: mean ± 1.96 * stdDev / sqrt(n)
    const ci: [number, number] =
      stats.count > 0
        ? [
            stats.mean - (1.96 * stats.stdDev) / Math.sqrt(stats.count),
            stats.mean + (1.96 * stats.stdDev) / Math.sqrt(stats.count),
          ]
        : [0, 0];
    result[technique] = { ...stats, confidenceInterval: ci };
  }
  return result;
}

// ──────────────────────────────────────────────
// Main resolver function
// ──────────────────────────────────────────────

/**
 * Fetches real emotion data from MongoDB, anonymizes it through
 * the AnonymizationService, and returns aggregated metrics.
 *
 * Called by the GraphQL `anonymizedMetrics` resolver.
 * Requires admin role (enforced by the calling resolver).
 */
export async function resolveAnonymizedMetrics(
  _parent: unknown,
  _args: unknown,
  context: { user: { id: string; role: string; email?: string } | null },
): Promise<{
  aggregateEmotionScores: Record<string, StatSummary>;
  techniqueEffectiveness: Record<string, StatSummary & { confidenceInterval: [number, number] }>;
  demographicBreakdown: Record<string, { count: number; percentage: number }>;
  temporalTrends: Record<string, unknown>;
  privacyMetrics: {
    kAnonymity: number;
    differentialPrivacyEpsilon: number;
    reidentificationRisk: number;
  };
}> {
  if (!context.user) {
    throw new Error("Authentication required");
  }

  // Only admin users can access anonymized metrics
  if (context.user.role !== "admin") {
    throw new Error("Admin role required for anonymized metrics");
  }

  try {
    // Step 1: Fetch recent sessions (up to 100 for privacy)
    const sessions = await aiRepository.getSessions({ status: "completed" });
    const recentSessions = sessions.slice(0, 100);

    if (recentSessions.length === 0) {
      // No data available — return empty metrics with default privacy values
      return {
        aggregateEmotionScores: {},
        techniqueEffectiveness: {},
        demographicBreakdown: {},
        temporalTrends: {},
        privacyMetrics: {
          kAnonymity: 5,
          differentialPrivacyEpsilon: 0.1,
          reidentificationRisk: 0,
        },
      };
    }

    // Step 2: Fetch emotion analyses for sessions
    const sessionIds = recentSessions.map((s) =>
      String((s as Record<string, unknown>).sessionId ?? (s as Record<string, unknown>)._id ?? ""),
    );

    const emotionResults: EmotionAnalysis[] = [];
    for (const sessionId of sessionIds) {
      try {
        const emotions = await aiRepository.getEmotionsForSession(sessionId);
        emotionResults.push(...emotions);
      } catch {
        // Skip sessions with missing emotion data
      }
    }

    if (emotionResults.length === 0) {
      return {
        aggregateEmotionScores: {},
        techniqueEffectiveness: {},
        demographicBreakdown: {},
        temporalTrends: {},
        privacyMetrics: {
          kAnonymity: 5,
          differentialPrivacyEpsilon: 0.1,
          reidentificationRisk: 0,
        },
      };
    }

    // Step 3: Transform to ResearchDataPoint format
    const sessionMap = new Map(
      recentSessions.map((s) => [
        String(
          (s as Record<string, unknown>).sessionId ?? (s as Record<string, unknown>)._id ?? "",
        ),
        s,
      ]),
    );

    const dataPoints: ResearchDataPoint[] = emotionResults
      .filter((e) => sessionMap.has(e.sessionId))
      .map((e) => toResearchDataPoint(e, sessionMap.get(e.sessionId)!));

    if (dataPoints.length === 0) {
      return {
        aggregateEmotionScores: {},
        techniqueEffectiveness: {},
        demographicBreakdown: {},
        temporalTrends: {},
        privacyMetrics: {
          kAnonymity: 5,
          differentialPrivacyEpsilon: 0.1,
          reidentificationRisk: 0,
        },
      };
    }

    // Step 4: Run through AnonymizationService
    // Use 'minimal' consent level — the AnonymizationService applies
    // k-anonymity suppression and differential privacy noise
    const anonymizationResult = await anonymizationService.anonymizeResearchData(
      dataPoints,
      "minimal",
    );

    const anonymizedData = anonymizationResult.anonymizedData;
    const privacyMetrics = anonymizationResult.privacyMetrics;

    // Step 5: Aggregate anonymized data
    const emotionScores = aggregateEmotionScores(anonymizedData);
    const techEffectiveness = aggregateTechniqueEffectiveness(anonymizedData);

    // Step 6: Build temporal trends (group by month)
    const monthlyGroups = new Map<string, ResearchDataPoint[]>();
    for (const dp of anonymizedData) {
      const month = new Date(dp.timestamp).toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyGroups.has(month)) monthlyGroups.set(month, []);
      monthlyGroups.get(month)!.push(dp);
    }

    const temporalTrends: Record<
      string,
      {
        emotionTrends: Record<string, { mean: number; trend: string; slope: number }>;
        techniqueTrends: Record<string, { mean: number; trend: string; slope: number }>;
      }
    > = {};

    const sortedMonths = [...monthlyGroups.keys()].sort();
    for (const month of sortedMonths) {
      const monthData = monthlyGroups.get(month)!;
      const emotionStats = aggregateEmotionScores(monthData);
      temporalTrends[month] = {
        emotionTrends: Object.fromEntries(
          Object.entries(emotionStats).map(([emotion, stats]) => [
            emotion,
            { mean: stats.mean, trend: "stable", slope: 0 },
          ]),
        ),
        techniqueTrends: {},
      };
    }

    // Step 7: Demographic breakdown (from session types, anonymized)
    const approachCounts = new Map<string, number>();
    for (const dp of anonymizedData) {
      const approach = dp.therapeuticApproach ?? "unknown";
      approachCounts.set(approach, (approachCounts.get(approach) ?? 0) + 1);
    }
    const totalAnonymized = anonymizedData.length;
    const demographicBreakdown: Record<string, { count: number; percentage: number }> = {};
    for (const [approach, count] of approachCounts) {
      demographicBreakdown[approach] = {
        count,
        percentage: totalAnonymized > 0 ? (count / totalAnonymized) * 100 : 0,
      };
    }

    // Step 8: Return with real privacy metrics
    return {
      aggregateEmotionScores: emotionScores,
      techniqueEffectiveness: techEffectiveness,
      demographicBreakdown,
      temporalTrends,
      privacyMetrics: {
        kAnonymity: privacyMetrics.kValue,
        differentialPrivacyEpsilon: privacyMetrics.epsilonValue,
        reidentificationRisk: privacyMetrics.reidentificationRisk,
      },
    };
  } catch (err) {
    logger.error("Failed to resolve anonymized metrics", {
      error: err instanceof Error ? err.message : String(err),
    });

    // Return safe empty response on error — don't leak partial data
    return {
      aggregateEmotionScores: {},
      techniqueEffectiveness: {},
      demographicBreakdown: {},
      temporalTrends: {},
      privacyMetrics: {
        kAnonymity: 0,
        differentialPrivacyEpsilon: 0,
        reidentificationRisk: 1,
      },
    };
  }
}
