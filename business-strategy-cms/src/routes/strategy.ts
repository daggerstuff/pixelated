import { Router } from 'express'
import { DocumentModelMongoose } from '../models/DocumentMongoose'
import { AIStrategyReviewService } from '../services/aiStrategyReviewService'
import { EdgeCaseMappingService } from '../services/edgeCaseMappingService'

const router = Router()

/**
 * Strategy vs. Reality Dashboard Endpoint
 * Returns:
 * - List of strategy documents
 * - Their AI feasibility scores
 * - Mapped technical edge cases (The "Reality")
 */
router.get('/dashboard', async (_req, res) => {
    try {
        const documents = await DocumentModelMongoose.find({}).lean()

        // We can either compute this on the fly or read from metadata. 
        // Since we ran the import script, metadata should be populated.
        // However, if new documents are added, we might want to trigger a check.
        // For this dashboard, we'll return the stored metadata + a summary.

        const dashboardData = await Promise.all(documents.map(async (doc: any) => {
            // If metadata is missing, maybe compute it? 
            // For now, assume import populated it, or return nulls.

            const strategies = {
                id: doc._id,
                title: doc.title,
                category: doc.category,
                status: doc.status,
                aiScore: doc.metadata?.reviewScore || 0,
                technicalBacking: {
                    edgeCaseCount: doc.metadata?.edgeCaseCount || 0,
                    hasTechnicalProof: (doc.metadata?.edgeCaseCount || 0) > 0
                },
                aiReview: doc.metadata?.aiReview || null
            }

            return strategies
        }))

        // Calculate aggregated stats
        const totalDocs = dashboardData.length
        const provenStrategies = dashboardData.filter(d => d.technicalBacking.hasTechnicalProof).length
        const averageFeasibility = dashboardData.reduce((acc, curr) => acc + curr.aiScore, 0) / (totalDocs || 1)

        res.json({
            overview: {
                totalStrategies: totalDocs,
                technicallyBackedStrategies: provenStrategies,
                realityGap: `${((1 - (provenStrategies / totalDocs)) * 100).toFixed(1)}%`,
                averageFeasibilityScore: averageFeasibility.toFixed(2)
            },
            data: dashboardData.sort((a, b) => b.aiScore - a.aiScore)
        })
    } catch (error) {
        console.error('Dashboard Error:', error)
        res.status(500).json({ error: 'Failed to generate strategy dashboard' })
    }
})

// Trigger a fresh re-analysis (manual refresh)
router.post('/refresh-analysis', async (_req, res) => {
    try {
        const documents = await DocumentModelMongoose.find({})
        let updatedCount = 0

        for (const doc of documents) {
            const review = await AIStrategyReviewService.reviewDocument(doc._id.toString())
            const mapping = await EdgeCaseMappingService.mapStrategyToEdgeCases(doc._id.toString())

            await DocumentModelMongoose.findByIdAndUpdate(doc._id, {
                $set: {
                    'metadata.reviewScore': review.overallScore,
                    'metadata.edgeCaseCount': mapping.mappedEdgeCases.length,
                    'metadata.aiReview': review
                }
            })
            updatedCount++
        }
        res.json({ message: `Successfully refreshed analysis for ${updatedCount} documents.` })
    } catch {
        res.status(500).json({ error: 'Analysis refresh failed' })
    }
})

export { router as strategyRouter }
