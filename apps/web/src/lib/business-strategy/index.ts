/**
 * Business Strategy Expansion & CMS System
 *
 * Core module for business intelligence and content management
 * Integrates with existing Pixelated Empathy infrastructure
 */

export * from './types'
export * from './services'

// Core services
export { MarketResearchService } from './lib/services/market-research'
export { CompetitiveIntelligenceService } from './lib/services/competitive-intelligence'
export { GrassrootsMarketingService } from './lib/services/grassroots-marketing'
export { DocumentManagementService } from './lib/services/document-management'
export { UserManagementService } from './lib/services/user-management'
export { WorkflowEngineService } from './lib/services/workflow-engine'

// Types
export type {
  NicheMarket,
  CompetitorProfile,
  MarketingTactic,
  Document,
  User,
  WorkflowExecution,
} from './types'
