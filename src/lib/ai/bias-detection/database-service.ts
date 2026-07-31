/**
 * Bias Detection Database Service
 *
 * Production-grade database operations for bias detection engine.
 * Handles all CRUD operations with proper error handling and HIPAA compliance.
 */

import { ObjectId } from "mongodb";

import mongodb from "../../../config/mongodb.config";
import { createBuildSafeLogger } from "../../logging/build-safe-logger";
import type {
  BiasAnalysisResult,
  BiasAlert,
  BiasDashboardData,
  BiasSummaryStats,
  BiasTrendData,
  DemographicBreakdown,
  DashboardRecommendation,
} from "./types";

interface MongoAlertDoc {
  alertId: string;
  timestamp: number;
  level: string;
  type: string;
  message: string;
  sessionId?: string;
  biasScore?: number;
  acknowledged?: boolean;
  resolvedAt?: Date | null;
}

interface MongoAnalysisDoc {
  sessionId: string;
  timestamp: Date;
  overallBiasScore: number;
  layerResults: unknown;
  demographics?: Record<string, string>;
  recommendations?: string[];
  alertLevel: string;
  explanation?: string;
  confidence?: number;
}

const logger = createBuildSafeLogger("BiasDetectionDatabase");

export class BiasDetectionDatabaseService {
  /**
   * Get database connection with validation
   */
  private async getDatabase() {
    try {
      // Check if mongodb client is available
      if (!mongodb) {
        throw new Error("MongoDB client not initialized");
      }

      const db = await mongodb.connect();

      // Validate the connection by attempting a simple operation
      await db.admin().ping();

      return db;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Database connection failed", {
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw new Error(`Database connection failed: ${errorMessage}`, {
        cause: error,
      });
    }
  }

  /**
   * Store bias analysis result in database
   */
  async storeAnalysisResult(result: BiasAnalysisResult, processingTimeMs?: number): Promise<void> {
    try {
      const db = await this.getDatabase();
      const collection = db.collection("bias_analyses");

      const document = {
        _id: new ObjectId(),
        ...result,
        processingTimeMs,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await collection.insertOne(document);

      logger.debug("Analysis result stored successfully", {
        sessionId: result.sessionId,
        analysisId: document._id,
        processingTimeMs,
      });
    } catch (error: unknown) {
      logger.error("Failed to store analysis result", {
        error: String(error),
        sessionId: result.sessionId,
      });
      throw error;
    }
  }

  /**
   * Store bias alert in database
   */
  async storeAlert(alert: BiasAlert, _analysisId?: string): Promise<void> {
    try {
      const db = await this.getDatabase();
      const collection = db.collection("bias_alerts");

      const document = {
        _id: new ObjectId(),
        ...alert,
        acknowledged: alert.acknowledged ?? false,
        resolvedAt: alert.resolvedAt ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await collection.insertOne(document);

      logger.debug("Alert stored successfully", {
        alertId: alert.alertId,
        level: alert.level,
        acknowledged: alert.acknowledged,
      });
    } catch (error: unknown) {
      logger.error("Failed to store alert", {
        error: String(error),
        alertId: alert.alertId,
      });
      throw error;
    }
  }

  /**
   * Get dashboard data from database
   */
  async getDashboardData(options?: {
    timeRange?: string;
    includeDetails?: boolean;
  }): Promise<BiasDashboardData> {
    try {
      const timeRange = options?.timeRange ?? "24h";
      const hoursBack = this.parseTimeRange(timeRange);
      const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      // Get summary statistics
      const summary = await this.getSummaryStats(cutoffTime);

      // Get recent alerts
      const alerts = await this.getRecentAlerts(cutoffTime);

      // Get trend data
      const rawTrends = await this.getTrendData(timeRange);
      const trends = rawTrends.map((t) => ({
        date: t.date,
        biasScore: t.biasScore,
        sessionCount: t.sessionCount,
        alertCount: t.alertCount,
        demographicBreakdown: t.demographicBreakdown,
      }));

      // Get demographic breakdown
      const demographics = await this.getDemographicBreakdown(cutoffTime);

      // Get recent analyses if details requested
      const recentAnalyses = options?.includeDetails
        ? await this.getRecentAnalyses(cutoffTime, 10)
        : [];

      // Generate recommendations based on data
      const recommendations = this.getRecommendations(summary, alerts);

      return {
        summary: {
          totalSessions: summary.totalSessions,
          averageBiasScore: summary.averageBiasScore,
          alertsLayerBreakdown: summary.alertsLayerBreakdown,
          alertsLast24h: summary.alertsLast24h,
          activeAlerts: summary.activeAlerts,
          trendDirection:
            summary.trendDirection === "increasing"
              ? ("worsening" as const)
              : summary.trendDirection === "decreasing"
                ? ("improving" as const)
                : summary.trendDirection,
          alerts: summary.alerts,
          criticalAlerts: summary.criticalIssues,
        },
        alerts,
        trends,
        demographics,
        recentAnalyses,
        recommendations,
      };
    } catch (error: unknown) {
      logger.error("Failed to get dashboard data", {
        error: String(error),
        timeRange: options?.timeRange,
      });
      throw error;
    }
  }

  /**
   * Get summary statistics
   */
  private async getSummaryStats(cutoffTime: Date): Promise<BiasSummaryStats> {
    try {
      const db = await this.getDatabase();

      // Get total sessions in the time range
      const totalSessions = await db
        .collection("bias_analyses")
        .countDocuments({ createdAt: { $gte: cutoffTime } });

      // Get average bias score
      const avgResult = (await db
        .collection("bias_analyses")
        .aggregate([
          { $match: { createdAt: { $gte: cutoffTime } } },
          { $group: { _id: null, avgScore: { $avg: "$overallBiasScore" } } },
        ])
        .toArray()) as Array<{ avgScore: number }>;

      const averageBiasScore =
        avgResult.length > 0 && avgResult[0]?.avgScore != null ? avgResult[0].avgScore : 0;

      // Get alerts in the last 24 hours
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const alertsLast24h = await db
        .collection("bias_alerts")
        .countDocuments({ createdAt: { $gte: last24h } });

      // Get critical alerts
      const criticalIssues = await db.collection("bias_alerts").countDocuments({
        level: "critical",
        createdAt: { $gte: cutoffTime },
      });

      // Calculate improvement rate (simplified)
      const improvementRate = Math.max(0, Math.min(1, 1 - averageBiasScore));

      // Calculate compliance score based on alerts and bias scores
      const complianceScore = Math.max(
        0,
        Math.min(100, 100 - averageBiasScore * 50 - criticalIssues * 5),
      );

      return {
        totalSessions,
        averageBiasScore,
        alertsLast24h,
        criticalIssues,
        improvementRate,
        complianceScore,
        activeAlerts: criticalIssues, // Fallback
        trendDirection: "stable" as const, // Fallback
        alertsLayerBreakdown: {}, // Fallback
        alerts: {
          low: 0,
          medium: 0,
          high: 0,
          critical: criticalIssues,
        },
      };
    } catch (error: unknown) {
      logger.error("Failed to get summary stats", {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get recent alerts
   */
  private async getRecentAlerts(cutoffTime: Date, limit: number = 50): Promise<BiasAlert[]> {
    try {
      const db = await this.getDatabase();
      const collection = db.collection("bias_alerts");

      const alerts = await collection
        .find({ createdAt: { $gte: cutoffTime } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      return alerts.map((raw) => {
        const alert = raw as unknown as MongoAlertDoc;
        return {
          alertId: alert.alertId,
          sessionId: alert.sessionId ?? "",
          timestamp: alert.timestamp,
          level: alert.level,
          message: alert.message,
          biasScore: alert.biasScore ?? 0,
          acknowledged: alert.acknowledged ?? false,
          resolvedAt: alert.resolvedAt ?? undefined,
        } as unknown as BiasAlert;
      });
    } catch (error: unknown) {
      logger.error("Failed to get recent alerts", {
        error: String(error),
      });
      return [];
    }
  }

  /**
   * Aggregate demographic breakdown from analysis documents.
   * Shared helper used by getTrendData() and getDemographicBreakdown().
   */
  private aggregateDemographics(analyses: MongoAnalysisDoc[]): DemographicBreakdown {
    const aggregation: Record<string, Record<string, { count: number; totalBias: number }>> = {
      age: {},
      gender: {},
      ethnicity: {},
      intersectional: {},
    };

    analyses.forEach((doc) => {
      const demo = doc.demographics;
      const biasScore = doc.overallBiasScore ?? 0;

      if (demo) {
        const update = (dimension: string, value: string) => {
          aggregation[dimension] ??= {};
          aggregation[dimension][value] ??= { count: 0, totalBias: 0 };
          aggregation[dimension][value].count++;
          aggregation[dimension][value].totalBias += biasScore;
        };

        if (demo["age"]) update("age", demo["age"]);
        if (demo["gender"]) update("gender", demo["gender"]);
        if (demo["ethnicity"]) update("ethnicity", demo["ethnicity"]);

        if (demo["age"] && demo["gender"] && demo["ethnicity"]) {
          const intersectionKey = [demo["age"], demo["gender"], demo["ethnicity"]].sort().join("|");
          update("intersectional", intersectionKey);
        }
      }
    });

    const result: DemographicBreakdown = {};

    Object.entries(aggregation).forEach(([dimension, values]) => {
      result[dimension] = {};
      Object.entries(values).forEach(([value, stats]) => {
        const dimResult = result[dimension];
        if (dimResult) {
          dimResult[value] = {
            count: stats.count,
            averageBias: stats.count > 0 ? stats.totalBias / stats.count : 0,
          };
        }
      });
    });

    return result;
  }

  /**
   * Get trend data for charts
   */
  private async getTrendData(timeRange: string): Promise<BiasTrendData[]> {
    try {
      const db = await this.getDatabase();
      const collection = db.collection("bias_analyses");

      const hoursBack = this.parseTimeRange(timeRange);
      const points = Math.min(24, hoursBack);
      const intervalHours = Math.max(1, Math.floor(hoursBack / points));

      const trends: BiasTrendData[] = [];

      for (let i = points - 1; i >= 0; i--) {
        const endTime = new Date(Date.now() - i * intervalHours * 60 * 60 * 1000);
        const startTime = new Date(endTime.getTime() - intervalHours * 60 * 60 * 1000);

        const analyses = await collection
          .find({
            createdAt: {
              $gte: startTime,
              $lt: endTime,
            },
          })
          .toArray();

        const alertCount = await db.collection("bias_alerts").countDocuments({
          createdAt: {
            $gte: startTime,
            $lt: endTime,
          },
        });

        const avgScore =
          analyses.length > 0
            ? analyses.reduce((sum, raw) => {
                const doc = raw as unknown as MongoAnalysisDoc;
                return sum + doc.overallBiasScore;
              }, 0) / analyses.length
            : 0;

        const demographicBreakdown = this.aggregateDemographics(
          analyses as unknown as MongoAnalysisDoc[],
        );

        trends.push({
          date: endTime.toISOString(),
          biasScore: avgScore,
          sessionCount: analyses.length,
          alertCount,
          demographicBreakdown,
        });
      }

      return trends;
    } catch (error: unknown) {
      logger.error("Failed to get trend data", {
        error: String(error),
        timeRange,
      });
      return [];
    }
  }

  /**
   * Get demographic breakdown
   */
  private async getDemographicBreakdown(cutoffTime: Date): Promise<DemographicBreakdown> {
    try {
      const db = await this.getDatabase();

      const analyses = await db
        .collection("bias_analyses")
        .find({ createdAt: { $gte: cutoffTime } })
        .toArray();

      return this.aggregateDemographics(analyses as unknown as MongoAnalysisDoc[]);
    } catch (error: unknown) {
      logger.error("Failed to get demographic breakdown", {
        error: String(error),
      });
      return {};
    }
  }

  /**
   * Get recent analyses
   */
  private async getRecentAnalyses(cutoffTime: Date, limit: number): Promise<BiasAnalysisResult[]> {
    try {
      const db = await this.getDatabase();
      const collection = db.collection("bias_analyses");

      const analyses = await collection
        .find({ createdAt: { $gte: cutoffTime } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      return analyses.map((raw) => {
        const analysis = raw as unknown as MongoAnalysisDoc;
        return {
          sessionId: analysis.sessionId,
          timestamp: analysis.timestamp,
          overallBiasScore: analysis.overallBiasScore,
          layerResults: analysis.layerResults,
          demographics: analysis.demographics,
          recommendations: analysis.recommendations ?? [],
          alertLevel: analysis.alertLevel,
          explanation: analysis.explanation,
          confidence: analysis.confidence,
        } as unknown as BiasAnalysisResult;
      });
    } catch (error: unknown) {
      logger.error("Failed to get recent analyses", {
        error: String(error),
      });
      return [];
    }
  }

  /**
   * Generate recommendations based on current data
   */
  private getRecommendations(
    summary: BiasSummaryStats,
    _alerts: BiasAlert[],
  ): DashboardRecommendation[] {
    const recommendations: DashboardRecommendation[] = [];

    if (summary.criticalIssues > 0) {
      recommendations.push({
        id: "critical-alerts",
        priority: "critical" as const,
        title: "Critical Bias Alerts Detected",
        description: `${summary.criticalIssues} critical bias issues require immediate attention`,
        action: "Review and address critical alerts immediately",
        impact: "High - Prevents potential harm and compliance violations",
      });
    }

    if (summary.averageBiasScore > 0.6) {
      recommendations.push({
        id: "high-bias-score",
        priority: "high" as const,
        title: "High Average Bias Score",
        description: `Average bias score of ${summary.averageBiasScore.toFixed(3)} exceeds recommended threshold`,
        action: "Review training data and model parameters",
        impact: "Medium - Improves overall system fairness",
      });
    }

    if (summary.improvementRate < 0.05) {
      recommendations.push({
        id: "stagnant-improvement",
        priority: "medium" as const,
        title: "Limited Bias Reduction Progress",
        description: "Bias scores have not improved significantly in recent period",
        action: "Implement additional bias mitigation strategies",
        impact: "Medium - Ensures continuous improvement",
      });
    }

    return recommendations;
  }

  /**
   * Parse time range string to hours
   */
  private parseTimeRange(timeRange: string): number {
    switch (timeRange) {
      case "1h":
        return 1;
      case "6h":
        return 6;
      case "24h":
        return 24;
      case "7d":
        return 24 * 7;
      case "30d":
        return 24 * 30;
      default:
        return 24;
    }
  }

  /**
   * Get session analysis by ID
   */
  async getSessionAnalysis(sessionId: string): Promise<BiasAnalysisResult | null> {
    try {
      const db = await this.getDatabase();
      const collection = db.collection("bias_analyses");

      const analysis = await collection.findOne({ sessionId });

      if (!analysis) {
        return null;
      }

      const doc = analysis as unknown as MongoAnalysisDoc;
      return {
        sessionId: doc.sessionId,
        timestamp: doc.timestamp,
        overallBiasScore: doc.overallBiasScore,
        layerResults: doc.layerResults,
        demographics: doc.demographics,
        recommendations: doc.recommendations ?? [],
        alertLevel: doc.alertLevel,
        explanation: doc.explanation,
        confidence: doc.confidence,
      } as unknown as BiasAnalysisResult;
    } catch (error: unknown) {
      logger.error("Failed to get session analysis", {
        error: String(error),
        sessionId,
      });
      return null;
    }
  }

  /**
   * Record system metrics
   */
  async recordSystemMetrics(metrics: {
    responseTimeMs: number;
    memoryUsageMb: number;
    cpuUsagePercent: number;
    activeConnections: number;
    cacheHitRate: number;
    pythonServiceStatus: "up" | "down" | "degraded";
    databaseStatus: "up" | "down" | "degraded";
    overallHealth: "healthy" | "degraded" | "critical";
    errorCount: number;
    errorRate: number;
  }): Promise<void> {
    try {
      const db = await this.getDatabase();
      const collection = db.collection("system_metrics");

      const document = {
        _id: new ObjectId(),
        ...metrics,
        timestamp: new Date(),
        createdAt: new Date(),
      };

      await collection.insertOne(document);

      logger.debug("System metrics recorded successfully", {
        overallHealth: metrics.overallHealth,
        responseTimeMs: metrics.responseTimeMs,
      });
    } catch (error: unknown) {
      logger.error("Failed to record system metrics", {
        error: error instanceof Error ? String(error) : String(error),
      });
      // Don't throw - system metrics recording should not break the main flow
    }
  }

  /**
   * Record audit log entry
   */
  async recordAuditLog(entry: {
    sessionId?: string;
    userId?: string;
    action: string;
    resource?: string;
    details?: unknown;
    ipAddress?: string;
    userAgent?: string;
    dataAccessed?: string[];
    retentionPeriodDays?: number;
  }): Promise<void> {
    try {
      const db = await this.getDatabase();
      const collection = db.collection("audit_logs");

      const document = {
        _id: new ObjectId(),
        ...entry,
        timestamp: new Date(),
        createdAt: new Date(),
        retentionExpiry: entry.retentionPeriodDays
          ? new Date(Date.now() + entry.retentionPeriodDays * 24 * 60 * 60 * 1000)
          : null,
      };

      await collection.insertOne(document);

      logger.debug("Audit log entry recorded successfully", {
        action: entry.action,
        userId: entry.userId,
        sessionId: entry.sessionId,
      });
    } catch (error: unknown) {
      logger.error("Failed to record audit log", {
        error: String(error),
        action: entry.action,
      });
      // Don't throw - audit logging should not break the main flow
    }
  }
}

// Singleton instance
export const biasDetectionDb = new BiasDetectionDatabaseService();
