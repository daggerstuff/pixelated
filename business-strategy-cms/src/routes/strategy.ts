import fs from 'fs'
import path from 'path'
import { Router } from 'express'

import { DocumentModelMongoose } from '../models/DocumentMongoose'
import { AIStrategyReviewService } from '../services/aiStrategyReviewService'
import { EdgeCaseMappingService } from '../services/edgeCaseMappingService'

const router = Router()

const LAST_IMPORT_FILE = path.join(
  process.cwd(),
  '.last-strategy-import.json',
)

/** Lean document shape returned by find().lean() for dashboard (metadata may include reviewScore, edgeCaseCount, aiReview, customFields). */
interface LeanStrategyDoc {
  _id: unknown
  title: string
  category: string
  status: string
  metadata?: Record<string, unknown>
}

function getSourceFile(metadata: Record<string, unknown> | undefined): string | undefined {
  if (!metadata || typeof metadata.customFields !== 'object' || metadata.customFields === null) return undefined
  const cf = metadata.customFields as Record<string, unknown>
  const v = cf.source_file
  return typeof v === 'string' ? v : undefined
}

/**
 * Strategy vs. Reality Dashboard Endpoint
 * Returns:
 * - List of strategy documents
 * - Their AI feasibility scores
 * - Mapped technical edge cases (The "Reality")
 */
router.get('/dashboard', async (_req, res) => {
  try {
    const documents = (await DocumentModelMongoose.find({}).lean()) as LeanStrategyDoc[]

    // We can either compute this on the fly or read from metadata.
    // Since we ran the import script, metadata should be populated.
    // However, if new documents are added, we might want to trigger a check.
    // For this dashboard, we'll return the stored metadata + a summary.

    const dashboardData = await Promise.all(
      documents.map(async (doc: LeanStrategyDoc) => {
        const strategies = {
          id: doc._id,
          title: doc.title,
          category: doc.category,
          status: doc.status,
          source_file: getSourceFile(doc.metadata),
          aiScore: doc.metadata?.reviewScore || 0,
          technicalBacking: {
            edgeCaseCount: doc.metadata?.edgeCaseCount || 0,
            hasTechnicalProof: (doc.metadata?.edgeCaseCount || 0) > 0,
          },
          aiReview: doc.metadata?.aiReview || null,
        }

        return strategies
      }),
    )

    // Calculate aggregated stats
    const totalDocs = dashboardData.length
    const provenStrategies = dashboardData.filter(
      (d) => d.technicalBacking.hasTechnicalProof,
    ).length
    const averageFeasibility =
      dashboardData.reduce((acc, curr) => acc + curr.aiScore, 0) /
      (totalDocs || 1)

    res.json({
      overview: {
        totalStrategies: totalDocs,
        technicallyBackedStrategies: provenStrategies,
        realityGap: `${((1 - provenStrategies / totalDocs) * 100).toFixed(1)}%`,
        averageFeasibilityScore: averageFeasibility.toFixed(2),
      },
      data: dashboardData.sort((a, b) => b.aiScore - a.aiScore),
    })
  } catch (error) {
    console.error('Dashboard Error:', error)
    res.status(500).json({ error: 'Failed to generate strategy dashboard' })
  }
})

/** Returns list of imported source_file paths and last import timestamp (from import script). */
router.get('/sources', (_req, res) => {
  try {
    if (!fs.existsSync(LAST_IMPORT_FILE)) {
      return res.json({ sources: [], lastImport: null })
    }
    const raw = fs.readFileSync(LAST_IMPORT_FILE, 'utf8')
    const data = JSON.parse(raw) as { sources?: string[]; lastImport?: string }
    res.json({
      sources: Array.isArray(data.sources) ? data.sources : [],
      lastImport: typeof data.lastImport === 'string' ? data.lastImport : null,
    })
  } catch {
    res.status(500).json({ error: 'Failed to read strategy import metadata' })
  }
})

// Trigger a fresh re-analysis (manual refresh)
router.post('/refresh-analysis', async (_req, res) => {
  try {
    const documents = await DocumentModelMongoose.find({})
    let updatedCount = 0

    for (const doc of documents) {
      const review = await AIStrategyReviewService.reviewDocument(
        doc._id.toString(),
      )
      const mapping = await EdgeCaseMappingService.mapStrategyToEdgeCases(
        doc._id.toString(),
      )

      await DocumentModelMongoose.findByIdAndUpdate(doc._id, {
        $set: {
          'metadata.reviewScore': review.overallScore,
          'metadata.edgeCaseCount': mapping.mappedEdgeCases.length,
          'metadata.aiReview': review,
        },
      })
      updatedCount++
    }
    res.json({
      message: `Successfully refreshed analysis for ${updatedCount} documents.`,
    })
  } catch {
    res.status(500).json({ error: 'Analysis refresh failed' })
  }
})

export { router as strategyRouter }
