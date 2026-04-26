import type { EmotionAnalysis } from "../../ai/emotions/types";
import type { Collection, Db, ObjectId as MongoObjectId } from "mongodb";
interface EmotionData {
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
type DatabaseObjectId = { toHexString(): string; toString(): string };
type DatabaseObjectIdCtor = (id?: string) => DatabaseObjectId;

interface MongoBridge {
  connect: () => Promise<Db>;
  getDb: () => Db;
}

type StoredDocument<T> = Omit<T, "id"> & { _id?: DatabaseObjectId };
type EmotionDataDocument = EmotionData & { _id?: DatabaseObjectId };
type EmotionAnalysisDocument = EmotionAnalysis & { _id?: DatabaseObjectId };
type TherapyClientRelationship = { therapistId: string; clientId: string };
type EmotionCorrelationDocument = Record<string, unknown> & {
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
// TODO: Create these service interfaces when services are implemented
interface EfficacyFeedback {
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

interface Technique {
  id: string;
  name: string;
  description: string;
  indication: string;
  category: string;
}

interface ClientProfile {
  preferences?: Record<string, unknown>;
  characteristics?: Record<string, unknown>;
  demographic?: Record<string, unknown>;
  history?: {
    pastTechniques: PastTechnique[];
  };
}

interface PastTechnique {
  techniqueId: string;
  techniqueName: string;
  lastUsed: Date;
  efficacy: number;
  usageCount: number;
}

interface BiasAnalysisResult {
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

interface BiasMetric {
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

interface BiasAlert {
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

interface AlertAction {
  type: string;
  timestamp: Date;
  userId: string;
  description: string;
  metadata?: Record<string, unknown>;
}

interface BiasAlertDistribution {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

interface BiasAggregatedMetrics {
  totalAnalyses: number;
  averageBiasScore: number;
  alertCounts: BiasAlertDistribution;
  demographics: Record<string, unknown>;
}

interface BiasTrendAnalysis {
  periodType: "daily" | "weekly" | "monthly";
  trends: Array<{
    period: string;
    biasScore: number;
    alertCount: number;
    sessionCount: number;
  }>;
}

interface BiasCustomAnalysis {
  analysisType: string;
  parameters: Record<string, unknown>;
  results: Record<string, unknown>;
}

interface BiasRecommendations {
  priority: "low" | "medium" | "high" | "critical";
  recommendations: Array<{
    type: string;
    description: string;
    actionItems: string[];
    timeline: string;
  }>;
}

interface BiasReport {
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
 * Repository for AI analysis results
 */
export class AIRepository {
  private async getCollection<T>(collectionName: string): Promise<Collection<StoredDocument<T>>> {
    const db = await this.getDatabase();
    return db.collection<StoredDocument<T>>(collectionName);
  }

  private mapStoredDocumentId<T>(
    document: StoredDocument<T>,
  ): Omit<StoredDocument<T>, "_id"> & { id: string } {
    const { _id, ...rest } = document;
    return {
      ...rest,
      id: _id?.toHexString() ?? "",
    };
  }

  private mapStoredDocumentIdArray<T>(
    documents: StoredDocument<T>[],
  ): Array<Omit<StoredDocument<T>, "_id"> & { id: string }> {
    return documents.map((doc) => this.mapStoredDocumentId<T>(doc));
  }

  private async getDatabase(): Promise<Db> {
    if (!mongodb) {
      throw new Error("MongoDB not available on client side");
    }

    try {
      return mongodb.getDb();
    } catch {
      // If not connected, try to connect
      await mongodb.connect();
      return mongodb.getDb();
    }
  }

  /**
   * Store a sentiment analysis result
   */
  async storeSentimentAnalysis(
    result: Omit<SentimentAnalysisResult, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    const collection = await this.getCollection<SentimentAnalysisResult>("ai_sentiment_analysis");
    const documentToInsert: Omit<StoredDocument<SentimentAnalysisResult>, "_id"> = {
      ...result,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { insertedId } = await collection.insertOne(documentToInsert);
    return insertedId.toHexString();
  }

  /**
   * Store a crisis detection result
   */
  async storeCrisisDetection(
    result: Omit<CrisisDetectionResult, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    const collection = await this.getCollection<CrisisDetectionResult>("ai_crisis_detection");
    const documentToInsert = {
      ...result,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { insertedId } = await collection.insertOne(documentToInsert);
    return insertedId.toHexString();
  }

  /**
   * Store a response generation result
   */
  async storeResponseGeneration(
    result: Omit<ResponseGenerationResult, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    const collection = await this.getCollection<ResponseGenerationResult>("ai_response_generation");
    const documentToInsert = {
      ...result,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { insertedId } = await collection.insertOne(documentToInsert);
    return insertedId.toHexString();
  }

  /**
   * Store an intervention analysis result
   */
  async storeInterventionAnalysis(
    result: Omit<InterventionAnalysisResult, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    if (!result.userId || !result.modelId || !result.modelProvider) {
      throw new Error("Missing required fields");
    }

    const collection = await this.getCollection<InterventionAnalysisResult>("ai_intervention_analysis");
    const documentToInsert = {
      ...result,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { insertedId } = await collection.insertOne(documentToInsert);
    return insertedId.toHexString();
  }

  /**
   * Update or create AI usage statistics
   */
  async updateUsageStats(stats: Omit<AIUsageStats, "id">): Promise<void> {
    const collection = await this.getCollection<AIUsageStats>("ai_usage_stats");
    await collection.updateOne(
      {
        userId: stats.userId,
        period: stats.period,
        date: stats.date,
      },
      { $set: stats },
      { upsert: true },
    );
  }

  /**
   * Get sentiment analysis results for a user
   */
  async getSentimentAnalysisByUser(
    userId: string,
    limit = 10,
    offset = 0,
  ): Promise<SentimentAnalysisResult[]> {
    const collection = await this.getCollection<SentimentAnalysisResult>("ai_sentiment_analysis");
    const results = await collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return this.mapStoredDocumentIdArray<SentimentAnalysisResult>(results);
  }

  /**
   * Get crisis detection results for a user
   */
  async getCrisisDetectionByUser(
    userId: string,
    limit = 10,
    offset = 0,
  ): Promise<CrisisDetectionResult[]> {
    const collection = await this.getCollection<CrisisDetectionResult>("ai_crisis_detection");
    const results = await collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return this.mapStoredDocumentIdArray<CrisisDetectionResult>(results);
  }

  /**
   * Get response generation results for a user
   */
  async getResponseGenerationByUser(
    userId: string,
    limit = 10,
    offset = 0,
  ): Promise<ResponseGenerationResult[]> {
    const collection = await this.getCollection<ResponseGenerationResult>("ai_response_generation");
    const results = await collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return this.mapStoredDocumentIdArray<ResponseGenerationResult>(results);
  }

  /**
   * Get intervention analysis results for a user
   */
  async getInterventionAnalysisByUser(
    userId: string,
    limit = 10,
    offset = 0,
  ): Promise<InterventionAnalysisResult[]> {
    const collection = await this.getCollection<InterventionAnalysisResult>(
      "ai_intervention_analysis",
    );
    const results = await collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return this.mapStoredDocumentIdArray<InterventionAnalysisResult>(results);
  }

  /**
   * Get AI usage statistics for a user
   */
  async getUsageStatsByUser(
    userId: string,
    period: "daily" | "weekly" | "monthly",
    limit = 30,
  ): Promise<AIUsageStats[]> {
    const collection = await this.getCollection<AIUsageStats>("ai_usage_stats");
    const results = await collection
      .find({ userId, period })
      .sort({ date: -1 })
      .limit(limit)
      .toArray();

    return this.mapStoredDocumentIdArray<AIUsageStats>(results);
  }

  /**
   * Get AI usage statistics for all users (admin only)
   */
  async getAllUsageStats(
    period: "daily" | "weekly" | "monthly",
    limit = 30,
  ): Promise<AIUsageStats[]> {
    const collection = await this.getCollection<AIUsageStats>("ai_usage_stats");
    const results = await collection
      .find({ period })
      .sort({ date: -1 })
      .limit(limit)
      .toArray();

    return this.mapStoredDocumentIdArray<AIUsageStats>(results);
  }

  /**
   * Get crisis detections with high risk level (admin only)
   */
  async getHighRiskCrisisDetections(limit = 20, offset = 0): Promise<CrisisDetectionResult[]> {
    const collection = await this.getCollection<CrisisDetectionResult>("ai_crisis_detection");
    const results = await collection
      .find({
        riskLevel: { $in: ["high", "critical"] },
        crisisDetected: true,
      })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return this.mapStoredDocumentIdArray<CrisisDetectionResult>(results);
  }

  /**
   * Get therapy sessions based on a filter
   *
   * @param filter The filter to apply
   * @returns Array of therapy sessions matching the filter
   */
  async getSessions(filter?: {
    clientId?: string;
    therapistId?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
  }): Promise<TherapySession[]> {
    const collection = await this.getCollection<TherapySession>("therapy_sessions");
    const query: Record<string, unknown> = {};

    if (filter?.clientId) {
      query.clientId = filter.clientId;
    }
    if (filter?.therapistId) {
      query.therapistId = filter.therapistId;
    }
    if (filter?.startDate) {
      query.startTime = { $gte: filter.startDate };
    }
    if (filter?.endDate) {
      query.endTime = { $lte: filter.endDate };
    }
    if (filter?.status) {
      query.status = filter.status;
    }

    const results = await collection
      .find(query)
      .sort({ startTime: -1 })
      .toArray();

    return this.mapStoredDocumentIdArray<TherapySession>(results);
  }

  /**
   * Get therapy sessions by their IDs
   *
   * @param sessionIds Array of session IDs to retrieve
   * @returns Array of therapy sessions matching the provided IDs
   */
  async getSessionsByIds(sessionIds: string[]): Promise<TherapySession[]> {
    if (!sessionIds.length) {
      return [];
    }

    const collection = await this.getCollection<TherapySession>("therapy_sessions");
    const objectIds = sessionIds
      .map((id) => {
        try {
          return ObjectId ? ObjectId(id) : null;
        } catch {
          // If not a valid ObjectId, search by string ID
          return null;
        }
      })
      .filter((value): value is DatabaseObjectId => Boolean(value));

    const results = await collection
      .find({ _id: { $in: objectIds } })
      .toArray();

    return this.mapStoredDocumentIdArray<TherapySession>(results);
  }

  /**
   * Get emotion analysis data for a specific session
   *
   * @param sessionId The session ID to get emotions for
   * @returns Array of emotion analysis data for the session
   */
  async getEmotionsForSession(sessionId: string): Promise<EmotionAnalysis[]> {
    const collection = await this.getCollection<EmotionAnalysisDocument>("ai_emotion_analyses");
    const results = await collection
      .find({ sessionId })
      .sort({ timestamp: 1 })
      .toArray();

    return this.mapStoredDocumentIdArray<EmotionAnalysis>(results);
  }

  /**
   * Check if a therapist is associated with a client
   *
   * @param therapistId The therapist ID to check
   * @param clientId The client ID to check against
   * @returns Boolean indicating if the therapist is associated with the client
   */
  async isTherapistForClient(therapistId: string, clientId: string): Promise<boolean> {
    const collection = await this.getCollection<TherapyClientRelationship>(
      "therapy_client_relationships",
    );
    const relationship = await collection.findOne({ therapistId, clientId });
    return !!relationship;
  }

  /**
   * Store efficacy feedback for a recommendation
   */
  async storeEfficacyFeedback(feedback: EfficacyFeedback): Promise<void> {
    const collection = await this.getCollection<EfficacyFeedback>("ai_efficacy_feedback");
    await collection.insertOne(feedback);
  }

  /**
   * Get technique by ID
   */
  async getTechniqueById(techniqueId: string): Promise<Technique | null> {
    const collection = await this.getCollection<Technique>("ai_therapeutic_techniques");
    let query: Record<string, unknown>;

    try {
      // Try to use as ObjectId first
      query = { _id: ObjectId ? ObjectId(techniqueId) : techniqueId };
    } catch {
      // If not a valid ObjectId, use as string
      query = { _id: techniqueId };
    }

    const result = await collection.findOne(query);

    if (!result) {
      return null;
    }

    return this.mapStoredDocumentId<Technique>(result);
  }

  /**
   * Get efficacy feedback for a technique
   */
  async getEfficacyFeedbackForTechnique(techniqueId: string): Promise<EfficacyFeedback[]> {
    const collection = await this.getCollection<EfficacyFeedback>("ai_efficacy_feedback");
    const results = await collection.find({ techniqueId }).toArray();

    return this.mapStoredDocumentIdArray<EfficacyFeedback>(results);
  }

  /**
   * Get efficacy feedback for a client
   */
  async getEfficacyFeedbackForClient(clientId: string): Promise<EfficacyFeedback[]> {
    const collection = await this.getCollection<EfficacyFeedback>("ai_efficacy_feedback");
    const results = await collection.find({ clientId }).toArray();

    return this.mapStoredDocumentIdArray<EfficacyFeedback>(results);
  }

  /**
   * Get techniques for a specific indication
   */
  async getTechniquesForIndication(indication: string): Promise<Technique[]> {
    const collection = await this.getCollection<Technique>("techniques");
    const results = await collection.find({ indications: indication }).toArray();

    return this.mapStoredDocumentIdArray<Technique>(results);
  }

  /**
   * Get a client's profile, including preferences, characteristics, and technique history.
   * Assumes existence of 'client_profiles' and 'client_technique_history' tables.
   */
  async getClientProfile(clientId: string): Promise<ClientProfile | null> {
    const profilesCollection = await this.getCollection<ClientProfile>("client_profiles");
    const techniquesCollection = await this.getCollection<PastTechnique>("client_technique_history");
    const profile = await profilesCollection.findOne({ clientId });

    if (!profile) {
      return null;
    }

    const techniqueHistory = await techniquesCollection
      .find({ clientId })
      .sort({ lastUsedAt: -1 })
      .toArray();

    return {
      ...profile,
      history: {
        pastTechniques: techniqueHistory.map((doc) => ({
          ...doc,
          id: doc._id.toHexString(),
        })),
      },
    };
  }

  /**
   * Store a bias analysis result
   */
  async storeBiasAnalysis(
    result: Omit<BiasAnalysisResult, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    const collection = await this.getCollection<BiasAnalysisResult>("ai_bias_analysis");
    const documentToInsert = {
      ...result,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { insertedId } = await collection.insertOne(documentToInsert);
    return insertedId.toHexString();
  }

  /**
   * Get bias analysis result by session ID
   */
  async getBiasAnalysisBySession(sessionId: string): Promise<BiasAnalysisResult | null> {
    const collection = await this.getCollection<BiasAnalysisResult>("ai_bias_analysis");
    const result = await collection
      .findOne({ sessionId }, { sort: { createdAt: -1 } });

    if (!result) {
      return null;
    }

    return this.mapStoredDocumentId<BiasAnalysisResult>(result);
  }

  /**
   * Get bias analysis results for a user
   */
  async getBiasAnalysisByUser(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      alertLevel?: string[];
      timeRange?: { start: Date; end: Date };
    },
  ): Promise<BiasAnalysisResult[]> {
    const collection = await this.getCollection<BiasAnalysisResult>("ai_bias_analysis");
    const query: Record<string, unknown> = { userId };

    if (options?.alertLevel) {
      query.alertLevel = { $in: options.alertLevel };
    }
    if (options?.timeRange) {
      query.createdAt = {
        $gte: options.timeRange.start,
        $lte: options.timeRange.end,
      };
    }

    const results = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(options?.offset ?? 0)
      .limit(options?.limit ?? 10)
      .toArray();

    return this.mapStoredDocumentIdArray<BiasAnalysisResult>(results);
  }

  /**
   * Store bias metric
   */
  async storeBiasMetric(metric: Omit<BiasMetric, "id" | "createdAt">): Promise<string> {
    const collection = await this.getCollection<BiasMetric>("ai_bias_metrics");
    const documentToInsert: Omit<StoredDocument<BiasMetric>, "_id"> = {
      ...metric,
      createdAt: new Date(),
    };
    const { insertedId } = await collection.insertOne(documentToInsert);
    return insertedId.toHexString();
  }

  /**
   * Get bias metrics
   */
  async getBiasMetrics(options?: {
    metricType?: string[];
    metricName?: string[];
    timeRange?: { start: Date; end: Date };
    aggregationPeriod?: string;
    userId?: string;
    limit?: number;
  }): Promise<BiasMetric[]> {
    const collection = await this.getCollection<BiasMetric>("ai_bias_metrics");
    const query: Record<string, unknown> = {};

    if (options?.metricType) {
      query.metricType = { $in: options.metricType };
    }
    if (options?.metricName) {
      query.metricName = { $in: options.metricName };
    }
    if (options?.aggregationPeriod) {
      query.aggregationPeriod = options.aggregationPeriod;
    }
    if (options?.userId) {
      query.userId = options.userId;
    }
    if (options?.timeRange) {
      query.timestamp = {
        $gte: options.timeRange.start,
        $lte: options.timeRange.end,
      };
    }

    const results = await collection
      .find(query)
      .sort({ timestamp: -1 })
      .limit(options?.limit ?? 10)
      .toArray();

    return this.mapStoredDocumentIdArray<BiasMetric>(results);
  }

  /**
   * Store bias alert
   */
  async storeBiasAlert(
    alert: Omit<
      BiasAlert,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "acknowledged"
      | "acknowledgedAt"
      | "acknowledgedBy"
      | "resolved"
      | "resolvedAt"
      | "resolvedBy"
      | "escalated"
      | "escalatedAt"
      | "actions"
      | "notificationChannels"
    > & { notificationChannels?: string[] },
  ): Promise<string> {
    const collection = await this.getCollection<BiasAlert>("ai_bias_alerts");
    const documentToInsert: Omit<StoredDocument<BiasAlert>, "_id"> = {
      ...alert,
      createdAt: new Date(),
      updatedAt: new Date(),
      acknowledged: false,
      resolved: false,
      escalated: false,
      actions: [],
      notificationChannels: alert.notificationChannels ?? [],
    };
    const { insertedId } = await collection.insertOne(documentToInsert);
    return insertedId.toHexString();
  }

  /**
   * Get bias alerts
   */
  async getBiasAlerts(options?: {
    alertLevel?: string[];
    alertType?: string[];
    timeRange?: { start: Date; end: Date };
    acknowledgedOnly?: boolean;
    unresolvedOnly?: boolean;
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<BiasAlert[]> {
    const collection = await this.getCollection<BiasAlert>("ai_bias_alerts");
    const query: Record<string, unknown> = {};

    if (options?.alertLevel) {
      query.alertLevel = { $in: options.alertLevel };
    }
    if (options?.alertType) {
      query.alertType = { $in: options.alertType };
    }
    if (options?.acknowledgedOnly) {
      query.acknowledged = true;
    }
    if (options?.unresolvedOnly) {
      query.resolved = false;
    }
    if (options?.userId) {
      query.userId = options.userId;
    }
    if (options?.timeRange) {
      query.createdAt = {
        $gte: options.timeRange.start,
        $lte: options.timeRange.end,
      };
    }

    const results = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(options?.offset ?? 0)
      .limit(options?.limit ?? 10)
      .toArray();

    return this.mapStoredDocumentIdArray<BiasAlert>(results);
  }

  /**
   * Update bias alert status
   */
  async updateBiasAlert(
    alertId: string,
    updates: {
      acknowledged?: boolean;
      acknowledgedBy?: string;
      resolved?: boolean;
      resolvedBy?: string;
      escalated?: boolean;
      actions?: AlertAction[];
    },
  ): Promise<boolean> {
    const collection = await this.getCollection<BiasAlert>("ai_bias_alerts");
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (updates["acknowledged"] !== undefined) {
      updateData.acknowledged = updates["acknowledged"];
      updateData.acknowledgedAt = updates["acknowledged"] ? new Date() : null;
      if (updates["acknowledgedBy"]) {
        updateData.acknowledgedBy = updates["acknowledgedBy"];
      }
    }

    if (updates["resolved"] !== undefined) {
      updateData.resolved = updates["resolved"];
      updateData.resolvedAt = updates["resolved"] ? new Date() : null;
      if (updates["resolvedBy"]) {
        updateData.resolvedBy = updates["resolvedBy"];
      }
    }

    if (updates["escalated"] !== undefined) {
      updateData.escalated = updates["escalated"];
      updateData.escalatedAt = updates["escalated"] ? new Date() : null;
    }

    if (updates["actions"]) {
      updateData.actions = updates["actions"];
    }

    const result = await collection.updateOne({ alertId }, { $set: updateData });

    return result.modifiedCount > 0;
  }

  /**
   * Store bias report
   */
  async storeBiasReport(report: {
    reportId: string;
    userId?: string;
    title: string;
    description?: string;
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
    expiresAt?: Date;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const collection = await this.getCollection<BiasReport>("ai_bias_reports");
    const documentToInsert = {
      ...report,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { insertedId } = await collection.insertOne(documentToInsert);
    return insertedId.toHexString();
  }

  /**
   * Get bias report by report ID
   */
  async getBiasReport(reportId: string): Promise<BiasReport | null> {
    const collection = await this.getCollection<BiasReport>("ai_bias_reports");
    const result = await collection.findOne({ reportId });

    if (!result) {
      return null;
    }

    return this.mapStoredDocumentId<BiasReport>(result);
  }

  /**
   * Get bias reports for a user
   */
  async getBiasReportsByUser(userId: string, limit = 10, offset = 0): Promise<BiasReport[]> {
    const collection = await this.getCollection<BiasReport>("ai_bias_reports");
    const results = await collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return this.mapStoredDocumentIdArray<BiasReport>(results);
  }

  /**
   * Get bias analysis summary statistics
   */
  async getBiasAnalysisSummary(): Promise<{
    totalAnalyses: number;
    averageBiasScore: number;
    alertDistribution: Record<string, number>;
    dailyTrends: Array<{ date: string; count: number; avgBias: number }>;
  }> {
    // Use the materialized view for better performance
    // TODO: Implement MongoDB aggregation for bias analysis summary
    return {
      totalAnalyses: 0,
      averageBiasScore: 0,
      alertDistribution: {},
      dailyTrends: [],
    };
  }


  /**
   * Get emotion data for sessions
   */
  async getEmotionData(sessionIds: string[]): Promise<EmotionData[]> {
    const collection = await this.getCollection<EmotionDataDocument>("emotion_data");
    const results = await collection
      .find({ sessionId: { $in: sessionIds } })
      .toArray();
    return results.map(({ _id: _, ...emotion }) => emotion);
  }

  /**
   * Get critical emotions for a client
   */
  async getCriticalEmotions(
    clientId: string,
    emotionTypes?: string[]
  ): Promise<EmotionData[]> {
    const collection = await this.getCollection<EmotionDataDocument>("emotion_analysis");
    const query: Record<string, unknown> = { clientId, riskLevel: 'critical' };
    if (emotionTypes && emotionTypes.length > 0) {
      query['emotionType'] = { $in: emotionTypes };
    }
    const results = await collection.find(query).toArray();
    return results.map(({ _id: _, ...emotion }) => emotion);
  }

  /**
   * Get emotion data by date range
   */
  async getEmotionDataByDateRange(
    clientId: string,
    startDate: Date,
    endDate: Date
  ): Promise<EmotionData[]> {
    const collection = await this.getCollection<EmotionDataDocument>("emotion_analysis");
    const results = await collection
      .find({
        clientId,
        timestamp: { $gte: startDate, $lte: endDate },
      })
      .toArray();
    return results.map(({ _id: _, ...emotion }) => emotion);
  }

  /**
   * Get emotion correlations
   */
  async getEmotionCorrelations(
    clientId: string,
    options?: { startDate?: Date; endDate?: Date }
  ): Promise<{ emotion1: string; emotion2: string; correlation: number }[]> {
    const collection = await this.getCollection<EmotionCorrelationDocument>("emotion_correlations");
    const query: Record<string, unknown> = { clientId };
    if (options?.startDate || options?.endDate) {
      const timestampQuery: Record<string, Date> = {};
      if (options.startDate) timestampQuery['$gte'] = options.startDate;
      if (options.endDate) timestampQuery['$lte'] = options.endDate;
      query['timestamp'] = timestampQuery;
    }
    const results = await collection.find(query).toArray();
    return results.map(({ _id: _, ...correlation }) => {
      return {
        emotion1: String(correlation.emotion1),
        emotion2: String(correlation.emotion2),
        correlation: Number(correlation.correlation),
      };
    });
  }
}
