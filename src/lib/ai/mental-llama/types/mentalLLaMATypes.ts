// Defines the core data structures for MentalLLaMA integration

/**
 * Represents the state of a previous conversation for contextual routing.
 */
export interface ConversationState {
  lastMessages?: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: string
  }>
  previousConversationState?: ConversationState
  detectedTopics?: string[]
  previousAnalysisResults?: string[]
  conversationSentiment?: 'positive' | 'negative' | 'neutral'
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  metadata?: Record<string, string | number | boolean>
}

/**
 * Insights data structure for routing decisions.
 */
export interface RoutingInsights {
  matchedKeywords?: string[]
  matchedKeyword?: string // For backward compatibility
  llmReasoning?: string
  contextualFactors?: string[]
  confidenceBreakdown?: Record<string, number>
  alternativeRoutes?: Array<{
    analyzer: string
    confidence: number
    reason: string
  }>
  processingTime?: number
  modelVersion?: string
  ruleAnalyzer?: string // For rule-based routing
  llmCategory?: string // For LLM-based routing
  hintUsed?: string // For explicit hint routing
  llmAgreed?: boolean // For consensus routing
  reason?: string // General reason field
  expertGuidanceApplied?: boolean // For expert guidance
  expertGuidanceSource?: string // Source of expert guidance
  clinicalEnhancement?: boolean // Clinical enhancement flag

  // Enhanced LLM insights
  llmConfidence?: number
  llmIsCriticalIntent?: boolean
  attemptsUsed?: number
  contextUsed?: boolean

  // Fallback information
  fallbackReason?: string
  llmFailed?: boolean
  contextHint?: string

  // Additional contextual information
  contextualRulesApplied?: string[]

  [key: string]: unknown // Allow additional properties for flexibility
}

/**
 * Raw output from the underlying LLM model.
 */
export interface RawModelOutput {
  modelName?: string
  modelVersion?: string
  rawResponse?: string
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  processingTime?: number
  temperature?: number
  maxTokens?: number
  finishReason?: 'stop' | 'length' | 'content_filter' | 'function_call'
  logprobs?: Record<string, number>
  metadata?: Record<string, unknown>
}

/**
 * LLM invocation options.
 */
export interface LLMInvocationOptions {
  temperature?: number
  max_tokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  stop?: string | string[]
  stream?: boolean
  logprobs?: boolean
  model?: string
  timeout?: number
  retries?: number
  providerSpecificParams?: Record<string, unknown>
}

/**
 * LLM response structure.
 */
export interface LLMResponse {
  content: string
  finishReason?: 'stop' | 'length' | 'content_filter' | 'function_call'
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  model?: string
  metadata?: Record<string, unknown>
}

/**
 * Interface for model provider implementations.
 */
export interface IModelProvider {
  invoke(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: LLMInvocationOptions,
  ): Promise<LLMResponse>
  getModelInfo(): {
    name: string
    version: string
    capabilities: string[]
  }
  isAvailable(): Promise<boolean>
}

/**
 * Interface for Python bridge implementations.
 */
export interface IPythonBridge {
  executeScript(
    scriptPath: string,
    args?: Record<string, unknown>,
  ): Promise<unknown>
  callFunction(
    moduleName: string,
    functionName: string,
    args?: unknown[],
  ): Promise<unknown>
  isAvailable(): Promise<boolean>
  getVersion(): Promise<string>
}

/**
 * Interface for mental health task router implementations.
 */
export interface IMentalHealthTaskRouter {
  route(input: RoutingInput): Promise<RoutingDecision>
  getAvailableAnalyzers(): string[]
  updateRoutingRules?(rules: Record<string, unknown>): void
}

/**
 * Common failure information structure used across different interfaces.
 */
export interface FailureInfo {
  errorType: string // Type of error that occurred
  errorMessage: string // Human-readable error description
  errorCode?: string // Machine-readable error code
  timestamp?: string // When the failure occurred
  retryAttempts?: number // Number of retry attempts made
  debugInfo?: Record<string, unknown> // Additional debug information
}

/**
 * Contextual information for routing a text analysis request.
 */
export interface RoutingContext {
  userId?: string
  sessionId?: string
  sessionType?: string // e.g., 'chat', 'journal_entry', 'crisis_intervention_follow_up'
  explicitTaskHint?: string // e.g., 'depression_check', 'safety_screen'
  previousConversationState?: ConversationState // For more advanced contextual routing
  failureInfo?: FailureInfo // Information about any failures in previous processing
}

/**
 * Input for the MentalHealthTaskRouter.
 */
export interface RoutingInput {
  text: string
  context?: RoutingContext
}

/**
 * Decision made by the MentalHealthTaskRouter.
 */
export interface RoutingDecision {
  alternativeRoutes?: Array<{
    analyzer: string
    confidence: number
    reason: string
  }>
  targetAnalyzer: string // e.g., 'crisis', 'depression', 'anxiety', 'general_mental_health', 'unknown'
  confidence: number // Confidence score (0.0 - 1.0) for the routing decision
  isCritical: boolean // True if the routing decision indicates a critical situation (e.g., crisis)
  method:
    | 'keyword'
    | 'llm'
    | 'contextual_rule'
    | 'explicit_hint'
    | 'default'
    | 'keyword_fallback'
    | 'context_fallback'
    | 'default_fallback' // How was this decision made?
  insights?: RoutingInsights // Additional details, e.g., matched keywords, LLM reasoning
  isFailure?: boolean // True if the routing process encountered a failure
  failureInfo?: {
    errorType:
      | 'llm_error'
      | 'parsing_error'
      | 'timeout'
      | 'invalid_input'
      | 'network_error'
      | 'unknown_error'
    errorMessage: string // Human-readable error description
    errorCode?: string // Machine-readable error code
    fallbackUsed?: boolean // True if a fallback mechanism was employed
    retryAttempts?: number // Number of retry attempts made
    timestamp?: string // When the failure occurred
  }
}

/**
 * Expert guidance information for mental health analysis.
 */
export interface ExpertGuidance {
  guidelines: Array<{
    category: string
    rule: string
    priority: 'high' | 'medium' | 'low'
    source: string // e.g., 'DSM-5', 'clinical_guidelines', 'best_practices'
  }>
  riskFactors: Array<{
    factor: string
    severity: 'critical' | 'high' | 'moderate' | 'low'
    description: string
  }>
  interventionSuggestions: Array<{
    intervention: string
    urgency: 'immediate' | 'urgent' | 'routine'
    rationale: string
  }>
  clinicalContext: {
    relevantDiagnoses?: string[]
    contraindications?: string[]
    specialConsiderations?: string[]
  }
  evidenceBase: Array<{
    source: string
    reliability: 'high' | 'medium' | 'low'
    summary: string
  }>
}

/**
 * Enhanced analysis result with expert guidance.
 */
export interface ExpertGuidedAnalysisResult extends MentalHealthAnalysisResult {
  expertGuided: boolean // True if expert guidance was applied
  expertGuidance?: ExpertGuidance // Expert guidance information
  clinicalRecommendations?: Array<{
    recommendation: string
    priority: 'critical' | 'high' | 'medium' | 'low'
    timeframe: string
    rationale: string
  }>
  riskAssessment?: {
    overallRisk: 'critical' | 'high' | 'moderate' | 'low'
    specificRisks: Array<{
      type: string
      level: 'critical' | 'high' | 'moderate' | 'low'
      indicators: string[]
    }>
    protectiveFactors?: string[]
  }
  qualityMetrics?: {
    guidanceRelevance: number // 0-1 score
    evidenceStrength: number // 0-1 score
    clinicalCoherence: number // 0-1 score
  }
}

/**
 * Represents the result of a mental health analysis.
 */
export interface MentalHealthAnalysisResult {
  hasMentalHealthIssue: boolean
  mentalHealthCategory: string // e.g., 'crisis', 'depression', 'anxiety', 'none', 'unknown'
  confidence: number // Overall confidence in the primary category
  explanation: string // Textual explanation of the findings
  supportingEvidence?: string[] // Snippets from the input text that support the findings
  isCrisis: boolean // True if a crisis was detected
  timestamp: string // ISO string of when the analysis was performed
  _routingDecision?: RoutingDecision // Optional: The routing decision that led to this analysis
  _rawModelOutput?: RawModelOutput // Optional: Raw output from the underlying LLM for debugging/logging
  _failures?: AnalysisFailure[] // Optional: Any failures that occurred during analysis
}

/**
 * Represents a failure that occurred during analysis.
 */
export interface AnalysisFailure {
  type:
    | 'crisis_notification'
    | 'session_flagging'
    | 'model_analysis'
    | 'routing'
    | 'general'
  message: string
  timestamp: string
  error?: unknown // Original error object for debugging
  context?: RoutingDecision // Optional: The routing decision that led to this analysis
  _rawModelOutput?: RawModelOutput // Optional: Raw output from the underlying LLM for debugging/logging
  isFailure?: boolean // True if the analysis process encountered a failure
  failureInfo?: {
    stage: 'routing' | 'analysis' | 'post_processing' | 'validation' | 'unknown' // Which stage failed
    errorType:
      | 'model_error'
      | 'parsing_error'
      | 'timeout'
      | 'invalid_response'
      | 'network_error'
      | 'validation_error'
      | 'unknown_error'
    errorMessage: string // Human-readable error description
    errorCode?: string // Machine-readable error code
    fallbackExplanation?: string // If a fallback explanation was generated due to failure
    partialResults?: boolean // True if some partial analysis results are still available
    retryAttempts?: number // Number of retry attempts made
    timestamp?: string // When the failure occurred
    debugInfo?: Record<string, unknown> // Additional debug information
  }
}

/**
 * Context for sending a crisis alert.
 * This should align with what ICrisisNotificationHandler expects.
 */
export interface CrisisContext {
  userId?: string
  sessionId?: string
  textSample: string // A snippet of the text that triggered the crisis alert
  timestamp: string // ISO string of when the crisis was detected
  decisionDetails: Partial<RoutingDecision> // Information from the routing decision
  analysisResult?: Partial<MentalHealthAnalysisResult> // Relevant parts of the analysis
  sessionType?: string // from RoutingContext
  explicitTaskHint?: string // from RoutingContext
}

/**
 * Defines the signature for a function that can invoke an LLM.
 * Takes a list of messages (e.g., in OpenAI chat format) and returns a promise
 * that resolves to the LLM's response (expected to be parsed JSON or string).
 */
export type LLMInvoker = (
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: LLMInvocationOptions,
) => Promise<LLMResponse>

/**
 * Options for constructing the MentalLLaMAAdapter.
 */
export interface MentalLLaMAAdapterOptions {
  modelProvider?: IModelProvider // Model provider implementation
  pythonBridge?: IPythonBridge // Python bridge implementation
  crisisNotifier?: ICrisisNotificationHandler
  taskRouter?: IMentalHealthTaskRouter // Mental health task router implementation
}

/**
 * Interface for a crisis notification handler.
 * This is often defined in a NotificationService file, but duplicated here for visibility
 * if the actual NotificationService interfaces are not directly accessible or to ensure alignment.
 * If a central ICrisisNotificationHandler exists, prefer importing that.
 */
export interface ICrisisNotificationHandler {
  sendCrisisAlert(alertContext: CrisisContext): Promise<void>
}

// Example of a more specific analysis result if needed in the future
export interface DepressionAnalysisResult extends MentalHealthAnalysisResult {
  beckDepressionInventoryScore?: number // Example specific field
}

// General purpose LLM Response for router if it needs to parse structured JSON
export interface LLMRoutingResponse {
  category: string
  confidence: number
  reasoning?: string
  sub_categories?: string[]
  is_critical_intent?: boolean
  isFailure?: boolean // True if the LLM response indicates a processing failure
  failureInfo?: {
    errorType:
      | 'model_unavailable'
      | 'response_malformed'
      | 'timeout'
      | 'rate_limited'
      | 'content_filtered'
      | 'unknown_error'
    errorMessage: string // Description of what went wrong
    errorCode?: string // Provider-specific error code
    fallbackResponse?: boolean // True if this is a fallback/default response
    timestamp?: string // When the failure occurred
  }
}
