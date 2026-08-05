/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never
    }
export type Maybe<T> = T | null
export type InputMaybe<T> = Maybe<T>
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string }
  String: { input: string; output: string }
  Boolean: { input: boolean; output: boolean }
  Int: { input: number; output: number }
  Float: { input: number; output: number }
  DateTime: { input: string; output: string }
  JSON: { input: Record<string, unknown>; output: Record<string, unknown> }
}

export type AnonymizedMetrics = {
  __typename: 'AnonymizedMetrics'
  aggregateEmotionScores: Scalars['JSON']['output']
  demographicBreakdown: Scalars['JSON']['output']
  privacyMetrics: PrivacyMetrics
  techniqueEffectiveness: Scalars['JSON']['output']
  temporalTrends: Scalars['JSON']['output']
}

export type ConversationMetadata = {
  __typename: 'ConversationMetadata'
  bias_score: Scalars['Float']['output']
  crisis_signals?: Maybe<Array<Scalars['String']['output']>>
  detected_techniques: Array<Scalars['String']['output']>
  safety_score: Scalars['Float']['output']
  technique_consistency: Scalars['Float']['output']
  therapeutic_effectiveness_score: Scalars['Float']['output']
}

export type ConversationRole = 'ASSISTANT' | 'USER'

export type ConversationTurn = {
  __typename: 'ConversationTurn'
  content: Scalars['String']['output']
  id: Scalars['ID']['output']
  pixelMetrics?: Maybe<PixelMetrics>
  role: ConversationRole
  timestamp: Scalars['DateTime']['output']
}

export type DemographicBreakdown = {
  __typename: 'DemographicBreakdown'
  count: Scalars['Int']['output']
  percentage: Scalars['Float']['output']
}

export type EqScores = {
  __typename: 'EQScores'
  emotional_awareness: Scalars['Float']['output']
  emotional_regulation: Scalars['Float']['output']
  empathy_recognition: Scalars['Float']['output']
  interpersonal_skills: Scalars['Float']['output']
  overall_eq: Scalars['Float']['output']
  social_cognition: Scalars['Float']['output']
}

export type EmotionAnalysis = {
  __typename: 'EmotionAnalysis'
  confidence: Scalars['Float']['output']
  dimensions: EmotionDimensions
  emotions: EmotionVector
  id: Scalars['ID']['output']
  metadata?: Maybe<EmotionMetadata>
  sessionId: Scalars['ID']['output']
  timestamp: Scalars['DateTime']['output']
}

export type EmotionConfidence = {
  __typename: 'EmotionConfidence'
  overall: Scalars['Float']['output']
  perEmotion: EmotionVector
}

export type EmotionDimensions = {
  __typename: 'EmotionDimensions'
  /** Activation level (0 to 1) */
  arousal: Scalars['Float']['output']
  /** Control/power level (-1 to 1) */
  dominance: Scalars['Float']['output']
  /** Positive/negative emotional tone (-1 to 1) */
  valence: Scalars['Float']['output']
}

export type EmotionMetadata = {
  __typename: 'EmotionMetadata'
  confidence: EmotionConfidence
  modelVersion: Scalars['String']['output']
  processingTime: Scalars['Float']['output']
  source: EmotionSource
}

export type EmotionSource = 'MULTIMODAL' | 'TEXT' | 'VOICE'

export type EmotionVector = {
  __typename: 'EmotionVector'
  anger: Scalars['Float']['output']
  anticipation: Scalars['Float']['output']
  disgust: Scalars['Float']['output']
  fear: Scalars['Float']['output']
  joy: Scalars['Float']['output']
  sadness: Scalars['Float']['output']
  surprise: Scalars['Float']['output']
  trust: Scalars['Float']['output']
}

export type InterventionRecord = {
  __typename: 'InterventionRecord'
  conversation: Scalars['String']['output']
  createdAt: Scalars['DateTime']['output']
  effectiveness: Scalars['Float']['output']
  id: Scalars['ID']['output']
  insights: Scalars['String']['output']
  intervention: Scalars['String']['output']
  metadata?: Maybe<Scalars['JSON']['output']>
  modelId: Scalars['String']['output']
  modelProvider: Scalars['String']['output']
  recommendedFollowUp?: Maybe<Scalars['String']['output']>
  updatedAt: Scalars['DateTime']['output']
  userId: Scalars['ID']['output']
  userResponse: Scalars['String']['output']
}

export type PersonaMode = 'ASSISTANT' | 'THERAPY'

export type PixelMetrics = {
  __typename: 'PixelMetrics'
  behavioral_pattern?: Maybe<Scalars['String']['output']>
  behavioral_pattern_confidence?: Maybe<Scalars['Float']['output']>
  confidence: Scalars['Float']['output']
  conversation_metadata?: Maybe<ConversationMetadata>
  eq_scores?: Maybe<EqScores>
  inference_time_ms: Scalars['Float']['output']
  memories?: Maybe<Array<Scalars['String']['output']>>
  persona_mode: PersonaMode
  response: Scalars['String']['output']
  warning?: Maybe<Scalars['String']['output']>
}

export type PrivacyMetrics = {
  __typename: 'PrivacyMetrics'
  differentialPrivacyEpsilon: Scalars['Float']['output']
  kAnonymity: Scalars['Int']['output']
  reidentificationRisk: Scalars['Float']['output']
}

export type Query = {
  __typename: 'Query'
  /** Get anonymized research metrics — admin only */
  anonymizedMetrics?: Maybe<AnonymizedMetrics>
  /** Get emotion analyses for a session */
  emotions: Array<EmotionAnalysis>
  /** Health check — public, no auth required */
  health: Scalars['String']['output']
  /** Get intervention records for a user */
  interventions: Array<InterventionRecord>
  /** Get a single session by ID */
  session?: Maybe<Session>
  /** List sessions with optional filters */
  sessions: Array<Session>
}

export type QueryEmotionsArgs = {
  sessionId: Scalars['ID']['input']
}

export type QueryInterventionsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>
  offset?: InputMaybe<Scalars['Int']['input']>
  userId: Scalars['ID']['input']
}

export type QuerySessionArgs = {
  id: Scalars['ID']['input']
}

export type QuerySessionsArgs = {
  clientId?: InputMaybe<Scalars['ID']['input']>
  endDate?: InputMaybe<Scalars['DateTime']['input']>
  limit?: InputMaybe<Scalars['Int']['input']>
  offset?: InputMaybe<Scalars['Int']['input']>
  startDate?: InputMaybe<Scalars['DateTime']['input']>
  status?: InputMaybe<SessionStatus>
  therapistId?: InputMaybe<Scalars['ID']['input']>
}

export type RiskAssessment = 'HIGH' | 'LOW' | 'MEDIUM'

export type Session = {
  __typename: 'Session'
  aiAnalysis?: Maybe<SessionAiAnalysis>
  clientId: Scalars['ID']['output']
  /** Emotion analyses for this session (owned by ai-inference-service) */
  emotions: Array<EmotionAnalysis>
  endTime: Scalars['DateTime']['output']
  id: Scalars['ID']['output']
  metadata?: Maybe<Scalars['JSON']['output']>
  notes?: Maybe<Scalars['String']['output']>
  sessionType?: Maybe<SessionType>
  startTime: Scalars['DateTime']['output']
  status?: Maybe<SessionStatus>
  therapistId?: Maybe<Scalars['ID']['output']>
  transcript?: Maybe<Scalars['String']['output']>
  /** Conversation turns for this session (in-memory, may be empty) */
  turns: Array<ConversationTurn>
}

export type SessionAiAnalysis = {
  __typename: 'SessionAIAnalysis'
  emotionalState: Array<Scalars['String']['output']>
  recommendations: Array<Scalars['String']['output']>
  riskAssessment: RiskAssessment
  techniques: Array<Scalars['String']['output']>
}

export type SessionStatus = 'ACTIVE' | 'CANCELLED' | 'COMPLETED' | 'SCHEDULED'

export type SessionType = 'CRISIS' | 'FAMILY' | 'GROUP' | 'INDIVIDUAL'

export type StatSummary = {
  __typename: 'StatSummary'
  count: Scalars['Int']['output']
  mean: Scalars['Float']['output']
  median: Scalars['Float']['output']
  stdDev: Scalars['Float']['output']
}

export type Subscription = {
  __typename: 'Subscription'
  /** Fires when a conversation turn is added to a session */
  conversationTurnAdded: ConversationTurn
  /** Fires when a new emotion analysis is created for a session */
  emotionAnalysisCreated: EmotionAnalysis
  /** Fires when a session is updated */
  sessionUpdated: Session
}

export type SubscriptionConversationTurnAddedArgs = {
  sessionId?: InputMaybe<Scalars['ID']['input']>
}

export type SubscriptionEmotionAnalysisCreatedArgs = {
  sessionId?: InputMaybe<Scalars['ID']['input']>
}

export type SubscriptionSessionUpdatedArgs = {
  sessionId?: InputMaybe<Scalars['ID']['input']>
}

export type TechniqueStat = {
  __typename: 'TechniqueStat'
  confidenceInterval: Array<Scalars['Float']['output']>
  count: Scalars['Int']['output']
  mean: Scalars['Float']['output']
  median: Scalars['Float']['output']
  stdDev: Scalars['Float']['output']
}

export type TemporalTrend = {
  __typename: 'TemporalTrend'
  emotionTrends: Scalars['JSON']['output']
  techniqueTrends: Scalars['JSON']['output']
}

export type TrendDirection = 'DECREASING' | 'INCREASING' | 'STABLE'

export type TrendPoint = {
  __typename: 'TrendPoint'
  mean: Scalars['Float']['output']
  slope: Scalars['Float']['output']
  trend: TrendDirection
}

export type GetAnonymizedMetricsQueryVariables = Exact<{ [key: string]: never }>

export type GetAnonymizedMetricsQuery = {
  __typename: 'Query'
  anonymizedMetrics: {
    __typename: 'AnonymizedMetrics'
    aggregateEmotionScores: Record<string, unknown>
    techniqueEffectiveness: Record<string, unknown>
    demographicBreakdown: Record<string, unknown>
    temporalTrends: Record<string, unknown>
    privacyMetrics: {
      __typename: 'PrivacyMetrics'
      kAnonymity: number
      differentialPrivacyEpsilon: number
      reidentificationRisk: number
    }
  } | null
}

export type GetEmotionsQueryVariables = Exact<{
  sessionId: string | number
}>

export type GetEmotionsQuery = {
  __typename: 'Query'
  emotions: Array<{
    __typename: 'EmotionAnalysis'
    id: string
    sessionId: string
    timestamp: string
    confidence: number
    emotions: {
      __typename: 'EmotionVector'
      joy: number
      sadness: number
      anger: number
      fear: number
      surprise: number
      disgust: number
      trust: number
      anticipation: number
    }
    dimensions: {
      __typename: 'EmotionDimensions'
      valence: number
      arousal: number
      dominance: number
    }
    metadata: {
      __typename: 'EmotionMetadata'
      source: EmotionSource
      processingTime: number
      modelVersion: string
      confidence: { __typename: 'EmotionConfidence'; overall: number }
    } | null
  }>
}

export type GetInterventionsQueryVariables = Exact<{
  userId: string | number
  limit?: number | null | undefined
  offset?: number | null | undefined
}>

export type GetInterventionsQuery = {
  __typename: 'Query'
  interventions: Array<{
    __typename: 'InterventionRecord'
    id: string
    userId: string
    conversation: string
    intervention: string
    userResponse: string
    effectiveness: number
    insights: string
    recommendedFollowUp: string | null
    modelId: string
    modelProvider: string
    createdAt: string
    updatedAt: string
  }>
}

export type HealthQueryVariables = Exact<{ [key: string]: never }>

export type HealthQuery = { __typename: 'Query'; health: string }

export type GetSessionQueryVariables = Exact<{
  id: string | number
}>

export type GetSessionQuery = {
  __typename: 'Query'
  session: {
    __typename: 'Session'
    id: string
    clientId: string
    therapistId: string | null
    startTime: string
    endTime: string
    sessionType: SessionType | null
    status: SessionStatus | null
    notes: string | null
    transcript: string | null
    aiAnalysis: {
      __typename: 'SessionAIAnalysis'
      emotionalState: Array<string>
      techniques: Array<string>
      recommendations: Array<string>
      riskAssessment: RiskAssessment
    } | null
  } | null
}

export type ListSessionsQueryVariables = Exact<{
  clientId?: string | number | null | undefined
  therapistId?: string | number | null | undefined
  status?: SessionStatus | null | undefined
  startDate?: string | null | undefined
  endDate?: string | null | undefined
  limit?: number | null | undefined
  offset?: number | null | undefined
}>

export type ListSessionsQuery = {
  __typename: 'Query'
  sessions: Array<{
    __typename: 'Session'
    id: string
    clientId: string
    therapistId: string | null
    startTime: string
    endTime: string
    sessionType: SessionType | null
    status: SessionStatus | null
    notes: string | null
  }>
}

export type GetSessionEmotionsQueryVariables = Exact<{
  sessionId: string | number
}>

export type GetSessionEmotionsQuery = {
  __typename: 'Query'
  session: {
    __typename: 'Session'
    id: string
    emotions: Array<{
      __typename: 'EmotionAnalysis'
      id: string
      sessionId: string
      timestamp: string
      confidence: number
      emotions: {
        __typename: 'EmotionVector'
        joy: number
        sadness: number
        anger: number
        fear: number
        surprise: number
        disgust: number
        trust: number
        anticipation: number
      }
      dimensions: {
        __typename: 'EmotionDimensions'
        valence: number
        arousal: number
        dominance: number
      }
    }>
  } | null
}

export type GetSessionTurnsQueryVariables = Exact<{
  sessionId: string | number
}>

export type GetSessionTurnsQuery = {
  __typename: 'Query'
  session: {
    __typename: 'Session'
    id: string
    turns: Array<{
      __typename: 'ConversationTurn'
      id: string
      role: ConversationRole
      content: string
      timestamp: string
    }>
  } | null
}

export type SessionUpdatedSubscriptionVariables = Exact<{
  sessionId?: string | number | null | undefined
}>

export type SessionUpdatedSubscription = {
  __typename: 'Subscription'
  sessionUpdated: {
    __typename: 'Session'
    id: string
    clientId: string
    therapistId: string | null
    startTime: string
    endTime: string
    sessionType: SessionType | null
    status: SessionStatus | null
  }
}

export type EmotionAnalysisCreatedSubscriptionVariables = Exact<{
  sessionId?: string | number | null | undefined
}>

export type EmotionAnalysisCreatedSubscription = {
  __typename: 'Subscription'
  emotionAnalysisCreated: {
    __typename: 'EmotionAnalysis'
    id: string
    sessionId: string
    timestamp: string
    confidence: number
    emotions: {
      __typename: 'EmotionVector'
      joy: number
      sadness: number
      anger: number
      fear: number
      surprise: number
      disgust: number
      trust: number
      anticipation: number
    }
    dimensions: {
      __typename: 'EmotionDimensions'
      valence: number
      arousal: number
      dominance: number
    }
  }
}

export type ConversationTurnAddedSubscriptionVariables = Exact<{
  sessionId?: string | number | null | undefined
}>

export type ConversationTurnAddedSubscription = {
  __typename: 'Subscription'
  conversationTurnAdded: {
    __typename: 'ConversationTurn'
    id: string
    role: ConversationRole
    content: string
    timestamp: string
  }
}
