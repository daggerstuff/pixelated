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
      index: true,
    },
    title: {
      type: String,
      required: true,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
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
        'custom',
      ],
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
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
          order: Number,
        },
      ],
      metadata: {
        wordCount: Number,
        readingTime: Number,
      },
    },

    // Status & Workflow
    status: {
      type: String,
      enum: ['draft', 'review', 'approved', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    revisions: [
      {
        revisionId: String,
        version: Number,
        timestamp: Date,
        author: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        changes: String,
        content: String,
      },
    ],

    // Permissions & Ownership
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    contributors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    permissions: {
      view: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      edit: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      comment: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
    },

    // Relationships
    linkedDocuments: [String],
    linkedProjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
      },
    ],
    tags: [
      {
        type: String,
        lowercase: true,
        index: true,
      },
    ],

    // SEO & Discovery
    seo: {
      metaTitle: String,
      metaDescription: String,
      keywords: [String],
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
          ref: 'User',
        },
      },
    ],
  },
  {
    timestamps: true,
    strict: true,
    collection: 'business_documents',
  },
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
      index: true,
    },
    name: {
      type: String,
      required: true,
      index: true,
    },
    description: String,
    status: {
      type: String,
      enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
      default: 'planning',
      index: true,
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
      index: true,
    },
    stakeholders: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        role: String,
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Scope & Objectives
    objectives: [
      {
        id: String,
        description: String,
        successCriteria: [String],
        priority: {
          type: String,
          enum: ['critical', 'high', 'medium', 'low'],
        },
        status: {
          type: String,
          enum: ['not_started', 'in_progress', 'completed', 'blocked'],
        },
      },
    ],

    // Linked Content
    linkedDocuments: [String],
    relatedProjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
      },
    ],

    // Metadata
    budget: Number,
    allocatedResources: [String],
    riskAssessment: String,
  },
  {
    timestamps: true,
    strict: true,
    collection: 'projects',
  },
)

ProjectSchema.index({ owner: 1, status: 1 })

// ============================================================================
// KNOWLEDGE ARTICLES SCHEMA
// ============================================================================

const KnowledgeArticleSchema = new mongoose.Schema(
  {
    articleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },

    // Content
    content: {
      type: String,
      required: true,
    },
    summary: String,
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Metadata
    publishedDate: Date,
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    featured: {
      type: Boolean,
      default: false,
    },

    // Engagement
    views: {
      type: Number,
      default: 0,
    },
    shares: {
      type: Number,
      default: 0,
    },
    likes: {
      type: Number,
      default: 0,
    },

    // SEO
    seo: {
      metaTitle: String,
      metaDescription: String,
      keywords: [String],
    },

    // Relationships
    tags: [
      {
        type: String,
        lowercase: true,
        index: true,
      },
    ],
    relatedArticles: [String],
    linkedResources: [String],
  },
  {
    timestamps: true,
    strict: true,
    collection: 'knowledge_articles',
  },
)

KnowledgeArticleSchema.index({ author: 1, status: 1 })
KnowledgeArticleSchema.index({ category: 1, status: 1 })

type BusinessDocumentDocument = mongoose.InferSchemaType<
  typeof BusinessDocumentSchema
>

// ============================================================================
// EXPORT MODELS
// ============================================================================

export const BusinessDocument =
  mongoose.models['BusinessDocument'] ??
  mongoose.model<BusinessDocumentDocument>(
    'BusinessDocument',
    BusinessDocumentSchema,
  )
export const Project = mongoose.model('Project', ProjectSchema)
export const KnowledgeArticle = mongoose.model(
  'KnowledgeArticle',
  KnowledgeArticleSchema,
)
