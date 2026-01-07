import mongoose, { Schema } from 'mongoose'
import { MarketData } from '@/types/business-intelligence'

const marketSegmentSchema = new Schema({
    name: { type: String, required: true },
    size: { type: Number, required: true },
    growthRate: { type: Number, required: true },
    penetration: { type: Number, default: 0 },
    keyDrivers: [{ type: String }],
    barriers: [{ type: String }],
})

const marketDataSchema = new Schema<MarketData>(
    {
        industry: { type: String, required: true, index: true },
        marketSize: { type: Number, required: true, min: 0 },
        growthRate: { type: Number, required: true },
        competitionLevel: { type: Number, min: 0, max: 1 },
        entryBarriers: { type: Number, min: 0, max: 10 },
        customerAcquisitionCost: { type: Number, min: 0 },
        lifetimeValue: { type: Number, min: 0 },
        segments: [marketSegmentSchema],
        timestamp: { type: Date, default: Date.now, index: true },
    },
    {
        collection: 'market_data',
        timestamps: true,
    },
)

// Index for efficient querying by industry and time
marketDataSchema.index({ industry: 1, timestamp: -1 })

export const MarketDataModel = mongoose.model<MarketData>(
    'MarketData',
    marketDataSchema,
)
