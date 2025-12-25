/**
 * Business Strategy Expansion & CMS System
 * 
 * Core module for business intelligence and content management
 * Integrates with existing Pixelated Empathy infrastructure
 */

export * from './types'
export * from './services'
export * from './utils'

// Core services
export { MarketResearchService } from './services/market-research'
export { CompetitiveIntelligenceService } from './services/competitive-intelligence'
export { GrassrootsMarketingService } from './services/grassroots-marketing'
export { DocumentManagementService } from './services/document-management'
export { UserManagementService } from './services/user-management'
export { WorkflowEngineService } from './services/workflow-engine'

// Types
export type {
    NicheMarket,
    CompetitorProfile,
    MarketingTactic,
    Document,
    User,
    WorkflowExecution
} from './types'