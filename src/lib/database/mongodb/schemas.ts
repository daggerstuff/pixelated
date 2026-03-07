// MongoDB Collections Schema Definitions
// Using Mongoose for type safety and validation

import mongoose from 'mongoose'

// ============================================================================
// BUSINESS DOCUMENTS SCHEMA
// ============================================================================

const BusinessDocumentSchema = new mongoose.Schema(
    {
        // Identity & Metadata
        documentId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        title: {
            type: String,
            required: true,
            index: true
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            index: true
        },
        type: {
            type: String,
            enum: [
                'strategy_plan',
                'market_analysis',
                'competitive_analysis',
                'case_study',
                'pitch_deck',
                'operational_guide',
                'research_report',
                'custom'
            ],
            required: true,
            index: true
        },
        category: {
            type: String,
            required: true,
            index: true
        },
        description: String,

        // Content
        content: {
            markdown: String,
            sections: [
                {
                    id: String,
                    title: String,
                    content: String,
                    order: Number
                }
            ],
            metadata: {
                wordCount: Number,
                readingTime: Number
            }
        },

        // Status & Workflow
        status: {
            type: String,
            enum: ['draft', 'review', 'approved', 'published', 'archived'],
            default: 'draft',
            index: true
        },
        version: {
            type: Number,
            default: 1
        },
        revisions: [
            {
                revisionId: String,
                version: Number,
                timestamp: Date,
                author: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User'
                },
                changes: String,
                content: String
            }
        ],

        // Permissions & Ownership
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        contributors: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }
        ],
        permissions: {
            view: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User'
                }
            ],
            edit: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User'
                }
            ],
            comment: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User'
                }
            ]
        },

        // Relationships
        linkedDocuments: [String],
        linkedProjects: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Project'
            }
        ],
        tags: [
            {
                type: String,
                lowercase: true,
                index: true
            }
        ],

        // SEO & Discovery
        seo: {
            metaTitle: String,
            metaDescription: String,
            keywords: [String]
        },

        // Attachments & Media
        attachments: [
            {
                id: String,
                filename: String,
                url: String,
                mimeType: String,
                size: Number,
                uploadedAt: Date,
                uploadedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User'
                }
            }
        ]
    },
    {
        timestamps: true,
        strict: true,
        collection: 'business_documents'
    }
)

// Add compound indexes for common queries
BusinessDocumentSchema.index({ owner: 1, status: 1 })
BusinessDocumentSchema.index({ type: 1, category: 1 })
BusinessDocumentSchema.index({ tags: 1 })

// ============================================================================
// PROJECTS SCHEMA
// ============================================================================

const ProjectSchema = new mongoose.Schema(
    {
        projectId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            index: true
        },
        description: String,
        status: {
            type: String,
            enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
            default: 'planning',
            index: true
        },

        // Timeline
        startDate: Date,
        targetCompletionDate: Date,
        actualCompletionDate: Date,

        // Leadership
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        stakeholders: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User'
                },
                role: String,
                joinedAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],

        // Scope & Objectives
        objectives: [
            {
                id: String,
                description: String,
                successCriteria: [String],
                priority: {
                    type: String,
                    enum: ['critical', 'high', 'medium', 'low']
                },
                status: {
                    type: String,
                    enum: ['not_started', 'in_progress', 'completed', 'blocked']
                }
            }
        ],

        // Linked Content
        linkedDocuments: [String],
        linkedStrategies: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'StrategicPlan'
            }
        ],
        relatedProjects: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Project'
            }
        ],

        // Metadata
        budget: Number,
        allocatedResources: [String],
        riskAssessment: String
    },
    {
        timestamps: true,
        strict: true,
        collection: 'projects'
    }
)

ProjectSchema.index({ owner: 1, status: 1 })

// ============================================================================
// MARKET RESEARCH SCHEMA
// ============================================================================

const MarketResearchSchema = new mongoose.Schema(
    {
        researchId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        title: {
            type: String,
            required: true,
            index: true
        },
        type: {
            type: String,
            enum: [
                'market_analysis',
                'competitor_analysis',
                'trend_research',
                'customer_research'
            ],
            required: true,
            index: true
        },

        // Research Data
        findings: [
            {
                id: String,
                title: String,
                description: String,
                impact: {
                    type: String,
                    enum: ['high', 'medium', 'low']
                },
                evidence: [String],
                implications: String
            }
        ],

        // Target Market Data
        targetMarkets: [
            {
                segment: String,
                size: Number,
                growth_rate: Number,
                key_players: [String],
                opportunities: [String],
                threats: [String]
            }
        ],

        // Competitive Landscape
        competitors: [
            {
                id: String,
                name: String,
                strengths: [String],
                weaknesses: [String],
                market_share: Number,
                pricing_strategy: String,
                unique_selling_proposition: String
            }
        ],

        // Timeline
        researchDate: Date,
        nextReviewDate: Date,
        sources: [
            {
                name: String,
                url: String,
                accessedDate: Date,
                credibility: {
                    type: String,
                    enum: ['high', 'medium', 'low']
                }
            }
        ],

        // Metadata
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        status: {
            type: String,
            enum: ['draft', 'validated', 'published'],
            default: 'draft',
            index: true
        }
    },
    {
        timestamps: true,
        strict: true,
        collection: 'market_research'
    }
)

MarketResearchSchema.index({ type: 1, status: 1 })

// ============================================================================
// STRATEGIC PLANS SCHEMA
// ============================================================================

const StrategicPlanSchema = new mongoose.Schema(
    {
        planId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        title: {
            type: String,
            required: true,
            index: true
        },
        planType: {
            type: String,
            enum: ['annual', 'quarterly', 'multi_year', 'product', 'market'],
            required: true
        },

        // Timeline
        fiscalYear: Number,
        quarter: Number,
        startDate: Date,
        endDate: Date,

        // Strategic Elements
        vision: String,
        mission: String,
        keyObjectives: [
            {
                id: String,
                title: String,
                description: String,
                keyResults: [
                    {
                        id: String,
                        description: String,
                        target: Number,
                        actual: Number,
                        unit: String,
                        dueDate: Date,
                        status: {
                            type: String,
                            enum: ['on_track', 'at_risk', 'off_track', 'completed']
                        }
                    }
                ]
            }
        ],

        // Initiatives & Projects
        initiatives: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Project'
            }
        ],

        // Resource Allocation
        budgetAllocation: {
            total: Number,
            byFunction: {
                sales: Number,
                marketing: Number,
                operations: Number,
                technology: Number,
                other: Number
            }
        },

        // Risk Management
        risks: [
            {
                id: String,
                description: String,
                probability: {
                    type: String,
                    enum: ['high', 'medium', 'low']
                },
                impact: {
                    type: String,
                    enum: ['high', 'medium', 'low']
                },
                mitigation_strategy: String,
                owner: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User'
                }
            }
        ],

        // Success Metrics
        kpis: [
            {
                id: String,
                name: String,
                target: Number,
                unit: String,
                measurement_frequency: String,
                owner: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User'
                },
                current_value: Number,
                last_updated: Date
            }
        ],

        // Review & Approval
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        approvers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }
        ],
        status: {
            type: String,
            enum: [
                'draft',
                'under_review',
                'approved',
                'executing',
                'completed',
                'archived'
            ],
            default: 'draft',
            index: true
        },
        approvalDate: Date
    },
    {
        timestamps: true,
        strict: true,
        collection: 'strategic_plans'
    }
)

StrategicPlanSchema.index({ owner: 1, status: 1 })
StrategicPlanSchema.index({ fiscalYear: 1, planType: 1 })

// ============================================================================
// SALES OPPORTUNITIES SCHEMA
// ============================================================================

const SalesOpportunitySchema = new mongoose.Schema(
    {
        opportunityId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        account: {
            type: String,
            required: true,
            index: true
        },

        // Opportunity Details
        title: {
            type: String,
            required: true,
            index: true
        },
        description: String,
        value: Number,
        currency: String,
        stage: {
            type: String,
            enum: [
                'prospect',
                'qualified_lead',
                'proposal',
                'negotiation',
                'won',
                'lost',
                'stalled'
            ],
            default: 'prospect',
            index: true
        },

        // Timeline
        createdDate: {
            type: Date,
            default: Date.now
        },
        expectedCloseDate: Date,
        actualCloseDate: Date,

        // People & Relationships
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        accountManager: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        contacts: [
            {
                name: String,
                email: String,
                phone: String,
                title: String,
                department: String,
                lastContact: Date
            }
        ],

        // Activity & Engagement
        nextAction: String,
        nextActionDate: Date,
        activities: [
            {
                type: String,
                date: Date,
                notes: String,
                participant: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User'
                }
            }
        ],

        // Metadata
        source: {
            type: String,
            enum: ['inbound', 'outbound', 'referral', 'event', 'partnership']
        },
        priority: {
            type: String,
            enum: ['high', 'medium', 'low']
        },
        probability: Number,

        // Documents
        linkedDocuments: [String]
    },
    {
        timestamps: true,
        strict: true,
        collection: 'sales_opportunities'
    }
)

SalesOpportunitySchema.index({ owner: 1, stage: 1 })
SalesOpportunitySchema.index({ account: 1, stage: 1 })

// ============================================================================
// KNOWLEDGE ARTICLES SCHEMA
// ============================================================================

const KnowledgeArticleSchema = new mongoose.Schema(
    {
        articleId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        title: {
            type: String,
            required: true,
            index: true
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        category: {
            type: String,
            required: true,
            index: true
        },

        // Content
        content: {
            type: String,
            required: true
        },
        summary: String,
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        // Metadata
        publishedDate: Date,
        status: {
            type: String,
            enum: ['draft', 'published', 'archived'],
            default: 'draft',
            index: true
        },
        featured: {
            type: Boolean,
            default: false
        },

        // Engagement
        views: {
            type: Number,
            default: 0
        },
        shares: {
            type: Number,
            default: 0
        },
        likes: {
            type: Number,
            default: 0
        },

        // SEO
        seo: {
            metaTitle: String,
            metaDescription: String,
            keywords: [String]
        },

        // Relationships
        tags: [
            {
                type: String,
                lowercase: true,
                index: true
            }
        ],
        relatedArticles: [String],
        linkedResources: [String]
    },
    {
        timestamps: true,
        strict: true,
        collection: 'knowledge_articles'
    }
)

KnowledgeArticleSchema.index({ author: 1, status: 1 })
KnowledgeArticleSchema.index({ category: 1, status: 1 })

// ============================================================================
// EXPORT MODELS
// ============================================================================

export const BusinessDocument = mongoose.model(
    'BusinessDocument',
    BusinessDocumentSchema
)
export const Project = mongoose.model('Project', ProjectSchema)
export const MarketResearch = mongoose.model(
    'MarketResearch',
    MarketResearchSchema
)
export const StrategicPlan = mongoose.model(
    'StrategicPlan',
    StrategicPlanSchema
)
export const SalesOpportunity = mongoose.model(
    'SalesOpportunity',
    SalesOpportunitySchema
)
export const KnowledgeArticle = mongoose.model(
    'KnowledgeArticle',
    KnowledgeArticleSchema
)
