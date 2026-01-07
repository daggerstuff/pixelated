import mongoose, { Schema } from 'mongoose'
import { BusinessMetrics } from '@/types/business-intelligence'

// Interface extension to include document properties
export interface BusinessMetricsDocument extends BusinessMetrics {
    id: string
    createdAt: Date
}

const businessMetricsSchema = new Schema<BusinessMetricsDocument>(
    {
        revenue: { type: Number, required: true, min: 0 },
        growthRate: { type: Number },
        customerAcquisitionCost: { type: Number, min: 0 },
        customerLifetimeValue: { type: Number, min: 0 },
        churnRate: { type: Number, min: 0, max: 1 },
        netPromoterScore: { type: Number, min: -100, max: 100 },
        marketShare: { type: Number, min: 0, max: 1 },
        createdAt: { type: Date, default: Date.now, index: true },
    },
    {
        collection: 'business_metrics',
        timestamps: true,
    },
)

export const BusinessMetricsModel = mongoose.model<BusinessMetricsDocument>(
    'BusinessMetrics',
    businessMetricsSchema,
)
