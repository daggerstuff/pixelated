import mongoose, { Schema } from 'mongoose'
import { CompetitorAnalysis } from '@/types/business-intelligence'

const competitorAnalysisSchema = new Schema<CompetitorAnalysis>(
    {
        competitors: { type: Number, required: true, min: 0 },
        marketLeader: { type: String, required: true },
        avgPricing: { type: Number, min: 0 },
        marketShareDistribution: { type: Map, of: Number },
        featureFrequency: { type: Map, of: Number },
        competitiveGaps: [{ type: String }],
        lastUpdated: { type: Date, default: Date.now, index: true },
    },
    {
        collection: 'competitor_analysis',
        timestamps: true,
    },
)

export const CompetitorAnalysisModel = mongoose.model<CompetitorAnalysis>(
    'CompetitorAnalysis',
    competitorAnalysisSchema,
)
