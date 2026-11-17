// Core type definitions for the MentalHealthAI system

/**
 * Represents the overall result of a mental health analysis.
 */

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
 * specific to MentalHealthAI.
 */
interface CrisisAlertContext {
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
type LLMInvoker = (
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
interface RoutingDecision {
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
interface RoutingContext {
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
type RoutingContextParams = Omit<RoutingContext, 'sessionHistory'>

/**
 * Represents a rule for keyword-based routing.
 */

/**
 * Maps LLM output categories to internal analyzer names and critical status.
 */
interface LLMCategoryMapEntry {
  targetAnalyzer: string
  isCritical: boolean
  confidenceBoost?: number // Optional boost to apply to LLM confidence for this category
}


/**
 * Configuration for the MentalHealthAI models.
 */
export interface MentalHealthAIModelConfig {
  modelId: string // Identifier for the specific model (e.g., 'mental-health-ai-chat-7b-v1')
  endpointUrl?: string // URL for the model inference API
  apiKey?: string // API key if required
  providerType:
    | 'azure_openai'
    | 'llm_api'
    | 'custom_api'
    | 'python_bridge' // Type of provider
  // Add other model-specific parameters as needed
}

/**
 * Parameters for the analyzeMentalHealth method in MentalHealthAIAdapter.
 */
export interface AnalyzeMentalHealthParams {
  text: string
  categories?: Array<string> | 'auto_route' | undefined // Specific categories to analyze or 'auto_route'
  routingContext?: RoutingContextParams | undefined // Context for the task router
  options?:
    | {
        modelTier?: '7B' | '13B' | string // Preferred model tier (string covers both literals)
        useExpertGuidance?: boolean
      }
    | undefined
}

// PythonBridge related types



// Add other core types and interfaces as they are identified.

/**
 * Basic message structure for LLM interactions.
 */
export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Represents the categories MentalHealthAI can analyze for or route to.
 */
export type MentalHealthAICategory =
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
// Type aliases like LLMInvoker, MentalHealthAICategory etc. are also exported due to `export type ...`.
// The final `export {};` is not strictly necessary if all intended exports are done directly.
// However, to be absolutely sure nothing is missed by a blanket statement, explicitly ensure all are exported.
// For now, the direct `export interface/type` should suffice. I'll remove the trailing `export {};`
