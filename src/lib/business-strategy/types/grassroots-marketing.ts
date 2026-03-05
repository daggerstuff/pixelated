/**
 * Grassroots Marketing Types
 */

import type { BaseEntity, } from './common'

export type EffortLevel = 'low' | 'medium' | 'high' | 'very-high'
export type ImpactScore = number // 0-100

export interface Resource {
    id: string
    type: 'time' | 'money' | 'people' | 'tools' | 'content'
    name: string
    description: string
    quantity: number
    unit: string
    cost?: number
    availability: 'available' | 'limited' | 'unavailable'
}

export interface Timeline {
    startDate: Date
    endDate: Date
    milestones: {
        name: string
        date: Date
        description: string
        deliverables: string[]
    }[]
    phases: {
        name: string
        startDate: Date
        endDate: Date
        description: string
        objectives: string[]
    }[]
}

export interface Metric {
    id: string
    name: string
    description: string
    type: 'quantitative' | 'qualitative'
    unit?: string
    target?: number
    baseline?: number
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly'
    dataSource: string
    calculationMethod?: string
}

export interface Template {
    id: string
    name: string
    type: 'email' | 'social-post' | 'blog-post' | 'script' | 'presentation' | 'document'
    description: string
    content: string
    variables: string[]
    instructions: string
    examples?: string[]
    lastUpdated: Date
}

export interface MarketingTactic extends BaseEntity {
    name: string
    description: string
    category: 'content' | 'community' | 'partnerships' | 'events' | 'pr' | 'referral'
    effortLevel: EffortLevel
    expectedImpact: ImpactScore
    resources: Resource[]
    timeline: Timeline
    successMetrics: Metric[]
    templates: Template[]
    instructions: string
    prerequisites?: string[]
    bestPractices: string[]
    commonMistakes: string[]
    caseStudies?: {
        organization: string
        summary: string
        results: string
        source: string
    }[]
    status: 'planned' | 'in-progress' | 'completed' | 'paused' | 'cancelled'
    actualEffort?: EffortLevel
    actualImpact?: ImpactScore
    lessons?: string[]
}

export interface Platform {
    id: string
    name: string
    type: 'social' | 'professional' | 'forum' | 'messaging' | 'video' | 'audio' | 'email'
    description: string
    audience: {
        size: number
        demographics: string[]
        interests: string[]
        behavior: string[]
    }
    contentTypes: string[]
    engagementRates: {
        average: number
        ourPerformance?: number
    }
    algorithms: string[]
    bestPractices: string[]
    limitations: string[]
    costs: {
        organic: boolean
        paidOptions: string[]
        minimumBudget?: number
    }
}

export interface CommunityStrategy extends BaseEntity {
    platformId: string
    platform: Platform
    objectives: string[]
    targetAudience: {
        demographics: string[]
        interests: string[]
        painPoints: string[]
        goals: string[]
    }
    contentStrategy: {
        themes: string[]
        contentTypes: string[]
        postingFrequency: string
        engagementTactics: string[]
    }
    communityGuidelines: string[]
    moderationPolicy: string
    crisisManagement: {
        scenarios: string[]
        responses: string[]
        escalationProcedure: string[]
    }
    metrics: Metric[]
    budget?: number
    timeline: Timeline
    resources: Resource[]
}

export interface Channel {
    id: string
    name: string
    type: 'owned' | 'earned' | 'shared' | 'paid'
    platform?: string
    audience: number
    engagementRate: number
    contentTypes: string[]
    postingSchedule: string
    moderators: string[]
    guidelines: string[]
}

export interface ContentCalendar extends BaseEntity {
    name: string
    description: string
    channels: Channel[]
    timeframe: {
        startDate: Date
        endDate: Date
    }
    themes: {
        name: string
        description: string
        keywords: string[]
        contentPillars: string[]
    }[]
    contentPlan: {
        date: Date
        channelId: string
        contentType: string
        title: string
        description: string
        status: 'planned' | 'created' | 'scheduled' | 'published'
        assignedTo?: string
        approvedBy?: string
        metrics?: {
            views?: number
            engagement?: number
            clicks?: number
            conversions?: number
        }
    }[]
    approvalWorkflow: {
        steps: string[]
        approvers: string[]
        deadlines: Date[]
    }
}

export interface Partnership extends BaseEntity {
    partnerName: string
    partnerType: 'organization' | 'individual' | 'media' | 'vendor' | 'customer'
    industry: string
    size: 'startup' | 'small' | 'medium' | 'large' | 'enterprise'
    contactInfo: {
        name: string
        title: string
        email: string
        phone?: string
        linkedin?: string
    }
    partnershipType: 'content' | 'event' | 'cross-promotion' | 'integration' | 'referral'
    status: 'prospect' | 'contacted' | 'negotiating' | 'active' | 'paused' | 'ended'
    valueProposition: {
        forUs: string[]
        forThem: string[]
    }
    collaborationAreas: string[]
    terms: {
        duration?: string
        exclusivity?: boolean
        financialTerms?: string
        deliverables: string[]
        responsibilities: {
            ours: string[]
            theirs: string[]
        }
    }
    successMetrics: Metric[]
    communications: {
        date: Date
        type: 'email' | 'call' | 'meeting' | 'event'
        summary: string
        nextSteps: string[]
    }[]
    documents: string[]
}

export interface AdvocacyProgram extends BaseEntity {
    name: string
    description: string
    type: 'referral' | 'ambassador' | 'case-study' | 'testimonial' | 'user-generated-content'
    objectives: string[]
    targetParticipants: {
        criteria: string[]
        size: number
        demographics: string[]
    }
    incentiveStructure: {
        type: 'monetary' | 'product' | 'recognition' | 'access' | 'experience'
        tiers: {
            name: string
            requirements: string[]
            rewards: string[]
        }[]
    }
    participationRequirements: string[]
    onboardingProcess: string[]
    supportResources: string[]
    communicationPlan: {
        frequency: string
        channels: string[]
        contentTypes: string[]
    }
    legalConsiderations: string[]
    metrics: Metric[]
    budget: number
    timeline: Timeline
    participants?: {
        userId: string
        joinDate: Date
        tier: string
        contributions: string[]
        rewards: string[]
        status: 'active' | 'inactive' | 'suspended'
    }[]
}

export interface GrassrootsStrategy extends BaseEntity {
    name: string
    description: string
    objectives: string[]
    targetAudience: {
        primary: string[]
        secondary: string[]
    }
    tactics: MarketingTactic[]
    communityStrategies: CommunityStrategy[]
    contentStrategies: ContentCalendar[]
    partnershipOpportunities: Partnership[]
    advocacyPrograms: AdvocacyProgram[]
    successMetrics: Metric[]
    budget: {
        totalBudget: number
        allocation: {
            category: string
            amount: number
            percentage: number
        }[]
    }
    timeline: Timeline
    riskAssessment: {
        risks: string[]
        mitigations: string[]
    }
    competitiveAdvantages: string[]
    expectedOutcomes: string[]
}