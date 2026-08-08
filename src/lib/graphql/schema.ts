/**
 * GraphQL SDL Schema — PIX-4064
 *
 * Root types: Session, ConversationTurn, EmotionAnalysis, InterventionRecord, AnonymizedMetrics
 *
 * Type mappings:
 * - Session           → TherapySession from `src/lib/ai/models/ai-types.ts` (DB canonical)
 * - EmotionAnalysis   → EmotionAnalysis from `src/lib/ai/emotions/types.ts`
 * - ConversationTurn  → ConversationTurn from `src/lib/pixel-conversation-integration.ts`
 * - InterventionRecord → InterventionAnalysisResult from `src/lib/db/ai/types.ts`
 * - AnonymizedMetrics → AnonymizedMetrics from `src/lib/research/types/research-types.ts`
 *
 * Federation boundary:
 * - ai-inference-service subgraph owns: EmotionAnalysis, InterventionRecord
 * - main app subgraph owns: Session, ConversationTurn, AnonymizedMetrics
 * (Currently a modular monolithic schema — ready to split into subgraphs.)
 */

export const typeDefs = /* GraphQL */ `
  # ──────────────────────────────────────────────
  # Directives (PIX-4065 — Field-Level Security)
  # ──────────────────────────────────────────────

  """
  Requires authentication. If 'scope' is provided, the caller must also
  have that scope (API key scopes or role mapping).

  - @auth: any authenticated user
  - @auth(scope: "admin"): admin role / admin scope
  - @auth(scope: "read"): read scope (API key users)
  """
  directive @auth(scope: String) on FIELD_DEFINITION

  """
  Requires the authenticated user to have a specific role.
  """
  directive @requireRole(role: String!) on FIELD_DEFINITION

  # ──────────────────────────────────────────────
  # Enums
  # ──────────────────────────────────────────────

  enum SessionType {
    INDIVIDUAL
    GROUP
    FAMILY
    CRISIS
  }

  enum SessionStatus {
    SCHEDULED
    ACTIVE
    COMPLETED
    CANCELLED
  }

  enum RiskAssessment {
    LOW
    MEDIUM
    HIGH
  }

  enum EmotionSource {
    TEXT
    VOICE
    MULTIMODAL
  }

  enum ConversationRole {
    USER
    ASSISTANT
  }

  enum PersonaMode {
    THERAPY
    ASSISTANT
  }

  enum TrendDirection {
    INCREASING
    DECREASING
    STABLE
  }

  # ──────────────────────────────────────────────
  # Scalars
  # ──────────────────────────────────────────────

  scalar JSON
  scalar DateTime

  # ──────────────────────────────────────────────
  # Emotion types (owned by ai-inference-service subgraph)
  # ──────────────────────────────────────────────

  type EmotionVector {
    joy: Float!
    sadness: Float!
    anger: Float!
    fear: Float!
    surprise: Float!
    disgust: Float!
    trust: Float!
    anticipation: Float!
  }

  type EmotionDimensions {
    "Positive/negative emotional tone (-1 to 1)"
    valence: Float!
    "Activation level (0 to 1)"
    arousal: Float!
    "Control/power level (-1 to 1)"
    dominance: Float!
  }

  type EmotionConfidence {
    overall: Float!
    perEmotion: EmotionVector!
  }

  type EmotionMetadata {
    source: EmotionSource!
    processingTime: Float!
    modelVersion: String!
    confidence: EmotionConfidence!
  }

  type EmotionAnalysis {
    id: ID!
    sessionId: ID!
    timestamp: DateTime!
    emotions: EmotionVector!
    dimensions: EmotionDimensions!
    confidence: Float!
    metadata: EmotionMetadata
  }

  # ──────────────────────────────────────────────
  # Conversation types (owned by main app subgraph)
  # ──────────────────────────────────────────────

  type EQScores {
    emotional_awareness: Float!
    empathy_recognition: Float!
    emotional_regulation: Float!
    social_cognition: Float!
    interpersonal_skills: Float!
    overall_eq: Float!
  }

  type ConversationMetadata {
    detected_techniques: [String!]!
    technique_consistency: Float!
    bias_score: Float!
    safety_score: Float!
    crisis_signals: [String!]
    therapeutic_effectiveness_score: Float!
  }

  type PixelMetrics {
    response: String!
    inference_time_ms: Float!
    eq_scores: EQScores
    conversation_metadata: ConversationMetadata
    persona_mode: PersonaMode!
    confidence: Float!
    behavioral_pattern: String
    behavioral_pattern_confidence: Float
    warning: String
    memories: [String!]
  }

  type ConversationTurn {
    id: ID!
    role: ConversationRole!
    content: String!
    timestamp: DateTime!
    pixelMetrics: PixelMetrics
  }

  # ──────────────────────────────────────────────
  # Session types (owned by main app subgraph)
  # ──────────────────────────────────────────────

  type SessionAIAnalysis {
    emotionalState: [String!]!
    techniques: [String!]!
    recommendations: [String!]!
    riskAssessment: RiskAssessment!
  }

  type Session {
    id: ID!
    clientId: ID!
    therapistId: ID
    startTime: DateTime!
    endTime: DateTime!
    sessionType: SessionType
    status: SessionStatus
    notes: String
    transcript: String
    metadata: JSON
    aiAnalysis: SessionAIAnalysis

    "Emotion analyses for this session (owned by ai-inference-service)"
    emotions: [EmotionAnalysis!]! @auth
    "Conversation turns for this session"
    turns(limit: Int, offset: Int): [ConversationTurn!]! @auth
  }

  # ──────────────────────────────────────────────
  # Intervention types (owned by ai-inference-service subgraph)
  # ──────────────────────────────────────────────

  type InterventionRecord {
    id: ID!
    userId: ID!
    conversation: String!
    intervention: String!
    userResponse: String!
    effectiveness: Float!
    insights: String!
    recommendedFollowUp: String
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
    modelId: String!
    modelProvider: String!
  }

  # ──────────────────────────────────────────────
  # Research / anonymized metrics (owned by main app subgraph)
  # ──────────────────────────────────────────────

  type StatSummary {
    mean: Float!
    median: Float!
    stdDev: Float!
    count: Int!
  }

  type TechniqueStat {
    mean: Float!
    median: Float!
    stdDev: Float!
    count: Int!
    confidenceInterval: [Float!]!
  }

  type DemographicBreakdown {
    count: Int!
    percentage: Float!
  }

  type TrendPoint {
    mean: Float!
    trend: TrendDirection!
    slope: Float!
  }

  type TemporalTrend {
    emotionTrends: JSON!
    techniqueTrends: JSON!
  }

  type PrivacyMetrics {
    kAnonymity: Int!
    differentialPrivacyEpsilon: Float!
    reidentificationRisk: Float!
  }

  type AnonymizedMetrics {
    aggregateEmotionScores: JSON!
    techniqueEffectiveness: JSON!
    demographicBreakdown: JSON!
    temporalTrends: JSON!
    privacyMetrics: PrivacyMetrics!
  }

  # ──────────────────────────────────────────────
  # Query
  # ──────────────────────────────────────────────

  type Query {
    "Get a single session by ID"
    session(id: ID!): Session @auth

    "List sessions with optional filters"
    sessions(
      clientId: ID
      therapistId: ID
      status: SessionStatus
      startDate: DateTime
      endDate: DateTime
      limit: Int = 50
      offset: Int = 0
    ): [Session!]! @auth

    "Get emotion analyses for a session"
    emotions(sessionId: ID!): [EmotionAnalysis!]! @auth

    "Get intervention records for a user"
    interventions(
      userId: ID!
      limit: Int = 10
      offset: Int = 0
    ): [InterventionRecord!]! @auth

    "Get anonymized research metrics — admin only"
    anonymizedMetrics: AnonymizedMetrics @auth(scope: "admin")

    "Health check — public, no auth required"
    health: String!
  }

  # ──────────────────────────────────────────────
  # Subscription (via graphql-ws)
  # ──────────────────────────────────────────────

  type Subscription {
    "Fires when a session is updated"
    sessionUpdated(sessionId: ID): Session! @auth

    "Fires when a new emotion analysis is created for a session"
    emotionAnalysisCreated(sessionId: ID): EmotionAnalysis! @auth

    "Fires when a conversation turn is added to a session"
    conversationTurnAdded(sessionId: ID): ConversationTurn! @auth
  }
`
