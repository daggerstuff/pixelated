// Core type definitions for the MentalLLaMA system

/**
 * Represents the overall result of a mental health analysis.
 */
export interface MentalLLaMAAnalysisResult {
  hasMentalHealthIssue: boolean
  mentalHealthCategory: string // e.g., 'depression', 'anxiety', 'crisis', 'none'
  confidence: number // Confidence score for the category (0.0 to 1.0)
  explanation: string // Textual explanation of the analysis
  supportingEvidence?: string[] // Specific phrases or sentences from the input text
  expertGuided?: boolean // True if expert guidance was used
  qualityMetrics?: ExplanationQualityMetrics // Metrics for the explanation quality
  timestamp: string // ISO string of when the analysis was performed
  modelTier?: string // Identifier for the model tier used (e.g., '7B', '13B')
  _routingDecision?: RoutingDecision | null // Optional: For logging/debugging the router's decision
  _rawModelOutput?: unknown // Optional: For logging/debugging raw output from the LLM
}

/**
 * Metrics for evaluating the quality of an explanation.
 * Scores typically range from 1.0 to 5.0.
 */
export interface ExplanationQualityMetrics {
  fluency: number
  completeness: number
  reliability: number
  overall: number
  assessment?: string // Optional assessment message or summary
}

/**
 * Context for sending a crisis alert.
 * This can be expanded from ICrisisNotificationHandler's CrisisAlertContext if needed,
 * or we can use that one directly. For now, let's assume it might have more details
 * specific to MentalLLaMA.
 */
export interface CrisisAlertContext {
  userId?: string | null
  sessionId?: string | null
  sessionType?: string | null // e.g., 'chat_support', 'journal_entry'
  explicitTaskHint?: string | boolean | null // from routing context
  timestamp: string // ISO string of when the crisis was detected
  textSample: string // The text (or a sample) that triggered the crisis
  decisionDetails?: RoutingDecision | Record<string, unknown> // Could be RoutingDecision or other metadata
  // Add other relevant details for crisis responders
}

/**
 * Interface for an LLM invoker, abstracting the actual call to an LLM.
 */
export type LLMInvoker = (
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: {
    temperature?: number
    max_tokens?: number
    [key: string]: unknown // other LLM params
  },
) => Promise<string> // Assuming JSON string or plain text response from LLM

/**
 * Represents a decision made by the MentalHealthTaskRouter.
 */
export interface RoutingDecision {
  method:
    | 'explicit_hint'
    | 'keyword'
    | 'llm_classification'
    | 'contextual_rule'
    | 'default_fallback'
    | 'none'
  targetAnalyzer: string // e.g., 'depression', 'anxiety', 'crisis', 'general_mental_health', 'unknown'
  confidence: number
  isCritical: boolean // True if the route indicates a potential crisis
  insights?: {
    matchedKeyword?: string
    llmRawOutput?: unknown
    ruleId?: string
    [key: string]: unknown
  }
}

/**
 * Contextual information provided to the MentalHealthTaskRouter.
 */
export interface RoutingContext {
  userId?: string | null
  sessionId?: string | null
  sessionHistory?: Array<{ role: 'user' | 'assistant'; content: string }> // Simplified history
  userProfile?: {
    age?: number
    knownConditions?: string[]
    // other relevant user data
  }
  sessionType?: string // e.g., 'crisis_intervention', 'regular_check_in'
  clientType?: 'web' | 'mobile' | 'api'
  // Any other context that might influence routing
}

/**
 * Parameters for the routing context, typically passed into `analyzeMentalHealth`.
 * Session history is excluded as it might be handled differently or added by the adapter if needed.
 */
export type RoutingContextParams = Omit<RoutingContext, 'sessionHistory'>

/**
 * Represents a rule for keyword-based routing.
 */
export interface KeywordRule {
  id: string
  targetAnalyzer: string
  keywords: Array<string | RegExp>
  confidence: number
  isCritical?: boolean // Defaults to false
  priority?: number // Higher number means higher priority
}

/**
 * Maps LLM output categories to internal analyzer names and critical status.
 */
export interface LLMCategoryMapEntry {
  targetAnalyzer: string
  isCritical: boolean
  confidenceBoost?: number // Optional boost to apply to LLM confidence for this category
}

export type LLMCategoryToAnalyzerMap = Record<string, LLMCategoryMapEntry>

/**
 * Configuration for the MentalLLaMA models.
 */
export interface MentalLLaMAModelConfig {
  modelId: string // Identifier for the specific model (e.g., 'mentalllama-chat-7b-v1')
  endpointUrl?: string // URL for the model inference API
  apiKey?: string // API key if required
  providerType: 'azure_openai' | 'together_ai' | 'custom_api' | 'python_bridge' // Type of provider
  // Add other model-specific parameters as needed
}

/**
 * Parameters for the analyzeMentalHealth method in MentalLLaMAAdapter.
 */
export interface AnalyzeMentalHealthParams {
  text: string
  categories?: Array<string> | 'auto_route' | undefined // Specific categories to analyze or 'auto_route'
  routingContext?: RoutingContextParams | undefined // Context for the task router
  options?:
    | {
        modelTier?: '7B' | '13B' | string // Preferred model tier
        useExpertGuidance?: boolean
      }
    | undefined
}

// PythonBridge related types
export interface PythonBridgeRequest {
  command: string
  payload: Record<string, unknown>
}

export interface PythonBridgeResponse {
  success: boolean
  data?: unknown
  error?: string
  logs?: string[]
}

export interface IMHIEvaluationParams {
  modelPath: string
  outputPath: string
  testDataset: string // e.g., 'IMHI'
  isLlama: boolean
}

// Add other core types and interfaces as they are identified.

/**
 * Basic message structure for LLM interactions.
 */
export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Represents the categories MentalLLaMA can analyze for or route to.
 */
export type MentalLLaMACategory =
  | 'depression'
  | 'anxiety'
  | 'crisis'
  | 'stress'
  | 'wellness'
  | 'ptsd' // Post-traumatic stress disorder
  | 'suicidality' // Specific routing target, may map to 'crisis'
  | 'bipolar_disorder'
  | 'ocd' // Obsessive-compulsive disorder
  | 'eating_disorder'
  | 'social_anxiety'
  | 'panic_disorder'
  | 'general_mental_health'
  | 'unknown'
  | 'none'

// Ensure all defined interfaces and types are exported if they are intended to be used by other modules.
// The `export interface ...` syntax already handles this for interfaces.
// Type aliases like LLMInvoker, MentalLLaMACategory etc. are also exported due to `export type ...`.
// The final `export {};` is not strictly necessary if all intended exports are done directly.
// However, to be absolutely sure nothing is missed by a blanket statement, explicitly ensure all are exported.
// For now, the direct `export interface/type` should suffice. I'll remove the trailing `export {};`
