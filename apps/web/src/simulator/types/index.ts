/**
 * Simulator types for load testing and simulation
 */

export interface SimulationConfig {
  mode: 'load_test' | 'stress_test' | 'soak_test'
  userCount: number
  duration: number
  rampUp: number
}

export interface BreachDetails {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  affectedUsers: string[]
  affectedData: string[]
  detectionMethod: string
  remediation: string
}

export interface NotificationResponse {
  totalNotifications: number
  deliveredNotifications: number
  notificationStatus: 'pending' | 'in_progress' | 'completed' | 'failed'
}

export interface LoadTestMetrics {
  breachCreationErrors: number
  notificationsSent: number
  averageProcessingTime: number
  successRate: number
}

import {
  TherapeuticDomain,
  ScenarioDifficulty,
  TherapeuticTechnique,
  FeedbackType,
} from '../../types/index'

export {
  TherapeuticDomain,
  ScenarioDifficulty,
  TherapeuticTechnique,
  FeedbackType,
}

// ============================================================================
// Simulator-specific type definitions
// ============================================================================

/** A therapeutic scenario for simulation */
export interface Scenario {
  id: string
  title: string
  description: string
  domain: TherapeuticDomain
  difficulty: ScenarioDifficulty
  clientProfile?: string
  presentingConcern?: string
  techniques?: TherapeuticTechnique[]
  /** Context description for the scenario */
  contextDescription: string
  /** Client background information */
  clientBackground: string
  /** Presenting issue description */
  presentingIssue: string
  /** Session objectives */
  objectives: string[]
  /** Suggested therapeutic approaches */
  suggestedApproaches?: string[]
  /** Optional initial client prompt */
  initialPrompt?: string
}

/** A user session in the simulator */
export interface UserSession {
  id: string
  userId: string
  scenarioId: string
  startedAt: number
  connectionStatus: 'connected' | 'disconnected' | 'connecting'
}

/** Real-time feedback during simulation */
export interface RealTimeFeedback {
  id?: string
  type: FeedbackType
  suggestion: string
  rationale: string
  priority: 'low' | 'medium' | 'high'
  context?: string
  timestamp: number
  techniques?: DetectedTechnique[]
  emotionState?: EmotionState | null
  speechPatterns?: SpeechPattern[]
  content?: string
  suggestedTechnique?: TherapeuticTechnique
  emotionalState?: { energy: number; valence: number; dominance: number }
  confidence?: number
  metadata?: Record<string, unknown>
}

/** Anonymized metrics collection */
export interface AnonymizedMetrics {
  sessionCount: number
  averageScore: number
  skillsImproving: string[]
  skillsNeeding: string[]
  lastSessionDate: number | null
}

export type AnonymizedMetric = AnonymizedMetrics

/** Simulation feedback result */
export interface SimulationFeedback {
  overallScore?: number
  techniqueScore?: number
  empathyScore?: number
  suggestions?: string[]
  strengths?: string[]
  areasForImprovement?: string[]
  type: FeedbackType
  message: string
  detectedTechniques: TherapeuticTechnique[]
  alternativeResponses?: string[]
  techniqueSuggestions?: TherapeuticTechnique[]
}

/** Emotion state from PAD (Pleasure-Arousal-Dominance) dimensions */
export interface EmotionState {
  valence: number
  energy: number
  dominance: number
  timestamp?: number
  trends?: string[]
}

/** Emotion trend direction */
export type EmotionTrend = 'improving' | 'declining' | 'stable' | 'volatile'

/** Detected speech pattern */
export interface SpeechPattern {
  type: string
  pattern: string
  confidence: number
  timestamp: number
  details?: Record<string, unknown>
}

/** Detected therapeutic technique */
export interface DetectedTechnique {
  technique: string
  name: string
  confidence: number
  timestamp: number
  category?: string
}

/** Full simulator state */
export interface SimulatorState {
  isRunning: boolean
  isProcessing: boolean
  hasConsent: boolean
  error: string | null
  emotionState: EmotionState | null
  speechPatterns: SpeechPattern[]
  detectedTechniques: DetectedTechnique[]
  connectionStatus: 'connected' | 'disconnected' | 'connecting'
}

/** WebRTC connection configuration */
export interface WebRTCConnectionConfig {
  iceServers: Array<{
    urls: string | string[]
    username?: string
    credential?: string
  }>
  iceTransportPolicy: 'relay' | 'all'
}

/** Feedback model configuration */
export interface FeedbackModelConfig {
  modelName: string
  temperature: number
  maxTokens: number
}

/** WebRTC service interface */
export interface WebRTCServiceInterface {
  connect(sessionId: string, userId: string): Promise<void>
  disconnect(): void
  sendMessage(message: unknown): void
}

/** Feedback service interface */
export interface FeedbackServiceInterface {
  analyzeFeedback(
    text: string,
    techniques: DetectedTechnique[],
    emotionState: EmotionState | null,
  ): Promise<RealTimeFeedback>
}

/** Speech recognition configuration */
export interface SpeechRecognitionConfig {
  language: string
  continuous: boolean
  interimResults: boolean
}

/** Speech recognition result */
export interface SpeechRecognitionResult {
  transcript: string
  confidence: number
  isFinal: boolean
}

/** Speech recognition hook props */
export interface SpeechRecognitionHookProps {
  onResult?: (result: SpeechRecognitionResult) => void
  onError?: (error: Error) => void
  config?: SpeechRecognitionConfig
}

/** Speech recognition hook result */
export interface SpeechRecognitionHookResult {
  isListening: boolean
  startListening: () => void
  stopListening: () => void
  transcript: string
  error: string | null
}

/** Therapeutic prompt for LLM analysis */
export interface TherapeuticPrompt {
  role: string
  content: string
}

/** Audio processor configuration */
export interface AudioProcessorConfig {
  sampleRate: number
  channels: number
  bitDepth: number
}

/** Emotion detection configuration */
export interface EmotionDetectionConfig {
  enabled: boolean
  provider: string
  sensitivity: number
}

/** Simulator context shape (matches useSimulator hook return) */
export interface SimulatorContext {
  currentScenario: Scenario | undefined
  setCurrentScenario: React.Dispatch<React.SetStateAction<Scenario | undefined>>
  isProcessing: boolean
  feedback: SimulationFeedback | undefined
  startSimulation: (scenarioId: string) => Promise<void>
  sendResponse: (response: string) => Promise<SimulationFeedback>
  metricsConsent: boolean
  setMetricsConsent: (consent: boolean) => void
}

/** Simulator context type */
export type SimulatorContextType = SimulatorContext

/** Provider props for simulator provider */
export interface SimulatorProviderProps {
  children: React.ReactNode
  initialState?: Partial<SimulatorState>
}

/** Container props for simulation views */
export interface SimulationContainerProps {
  scenarioId: string
  className?: string
  onBackToScenarios?: () => void
  onComplete?: (feedback: SimulationFeedback) => void
}

/** Props for scenario selector */
export interface ScenarioSelectorProps {
  scenarios?: Scenario[]
  onSelectScenario: (id: string) => void
}
