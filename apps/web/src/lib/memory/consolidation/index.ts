export { MemoryInventory } from './memory-inventory'
export type { MemoryCatalog, InventoryGroup } from './memory-inventory'
export { SemanticDeduplicator } from './dedup'
export type { DedupCluster, DedupResult } from './dedup'
export { RemDreamScheduler } from './rem-dream'
export type { CrossLink, Schema, DreamResult } from './rem-dream'
export { ForgettingEngine } from './forgetting'
export type {
  ForgetAction,
  ForgetDecision,
  ForgettingConfig,
} from './forgetting'
export { ConsolidationTriggerEngine, TriggerType } from './rules'
export type { TriggerEvent, TriggerConfig } from './rules'
export { ConsolidationPipeline } from './consolidation-pipeline'
export type {
  ConsolidationReport,
  ConsolidationConfig,
  SchemaPattern,
} from './consolidation-pipeline'
