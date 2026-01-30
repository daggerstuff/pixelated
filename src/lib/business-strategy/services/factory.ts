/**
 * Service Factory
 * 
 * Central point for accessing business strategy services.
 * Ensures services are properly initialized and shared across the application.
 */

import { DocumentManagementService } from './document-management'
import { MarketResearchService } from './market-research'
import { CompetitiveIntelligenceService } from './competitive-intelligence'
import { UserManagementService } from './user-management'
import { WorkflowEngineService } from './workflow-engine'
import { AuditService } from './audit'

export class ServiceFactory {
    private static instances: Map<string, any> = new Map()

    /**
     * Get DocumentManagementService instance
     */
    static getDocumentManagement(): DocumentManagementService {
        return this.getOrCreate('document-management', () => new DocumentManagementService())
    }

    /**
     * Get MarketResearchService instance
     */
    static getMarketResearch(): MarketResearchService {
        return this.getOrCreate('market-research', () => new MarketResearchService())
    }

    /**
     * Get CompetitiveIntelligenceService instance
     */
    static getCompetitiveIntelligence(): CompetitiveIntelligenceService {
        return this.getOrCreate('competitive-intelligence', () => new CompetitiveIntelligenceService())
    }

    /**
     * Get UserManagementService instance
     */
    static getUserManagement(): UserManagementService {
        return this.getOrCreate('user-management', () => new UserManagementService())
    }

    /**
     * Get WorkflowEngineService instance
     */
    static getWorkflowEngine(): WorkflowEngineService {
        return this.getOrCreate('workflow-engine', () => new WorkflowEngineService())
    }

    /**
     * Get AuditService instance
     */
    static getAudit(): AuditService {
        return this.getOrCreate('audit', () => new AuditService())
    }

    private static getOrCreate<T>(name: string, creator: () => T): T {
        if (!this.instances.has(name)) {
            this.instances.set(name, creator())
        }
        return this.instances.get(name)
    }
}
