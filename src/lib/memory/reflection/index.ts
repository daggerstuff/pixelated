export { ReflexionEngine, FeedbackType } from './reflexion'
export type {
  ActionFeedbackPair,
  VerbalReflection,
  ReflexionResult,
} from './reflexion'

export { SessionConsolidator } from './session-consolidation'
export type { SessionSummary, EmotionalArc } from './session-consolidation'

export { PatternDetector } from './pattern-detection'
export type {
  PatternReport,
  RecurringTheme,
  ProgressTrend,
  TriggerPattern,
} from './pattern-detection'

export { DreamReflectionIntegrator } from './dream-integration'
export type {
  DreamReflectionResult,
  DreamReflectionInsight,
} from './dream-integration'

export { ActionPipeline, ActionPriority } from './action-pipeline'
export type {
  ActionRecommendation,
  TherapistNotification,
  UserReflectionSummary,
  UserFeedback,
} from './action-pipeline'

export {
  evaluateReflectionOutcome,
  createRuleBasedEvaluator,
  DEFAULT_EVALUATOR,
} from './outcome-evaluator'
export type {
  EvaluationResult,
  GroundTruthSignal,
  OutcomeEvaluator,
  ReflectionOutcome,
} from './outcome-evaluator'

export { proposeGuidanceUpdate, NoopGuidanceWriter } from './guidance-writer'
export type {
  GuidanceWriter,
  ProposeGuidanceOptions,
  ProposeGuidanceResult,
} from './guidance-writer'

export {
  ReflectionMetricsRecorder,
  defaultRecorder,
} from './reflection-metrics'
export type {
  ReflectionMetricsInput,
  ReflectionMetricsAggregate,
} from './reflection-metrics'
