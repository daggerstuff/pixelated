import fs from 'fs'
import path from 'path'

import { Router } from 'express'

import { authenticateToken } from '../middleware/auth'
import { DocumentModelMongoose } from '../models/DocumentMongoose'
import { AIStrategyReviewService } from '../services/aiStrategyReviewService'
import { EdgeCaseMappingService } from '../services/edgeCaseMappingService'

const router = Router()

const LAST_IMPORT_FILE = path.join(process.cwd(), '.last-strategy-import.json')

/** Lean document shape returned by find().lean() for dashboard (metadata may include reviewScore, edgeCaseCount, aiReview, customFields). */
interface LeanStrategyDoc {
  _id: unknown
  title: string
  category: string
  status: string
  metadata?: Record<string, unknown>
}

const getMetadataRecord = (
  value: unknown,
): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined

const getMetadataNumber = (
  metadata: Record<string, unknown> | undefined,
  key: string,
): number => {
  const value = metadata?.[key]
  return typeof value === 'number' ? value : 0
}

function getSourceFile(
  metadata: Record<string, unknown> | undefined,
): string | undefined {
  const customFields = getMetadataRecord(metadata?.['customFields'])
  if (!customFields) {
    return undefined
  }

  const v = customFields['source_file']
  return typeof v === 'string' ? v : undefined
}

/**
 * Strategy vs. Reality Dashboard Endpoint
 * Returns:
 * - List of strategy documents
 * - Their AI feasibility scores
 * - Mapped technical edge cases (The "Reality")
 */
router.get('/dashboard', authenticateToken, async (_req, res) => {
  try {
    const documents = (await DocumentModelMongoose.find({}, undefined, {
      lean: true,
    })) as unknown as LeanStrategyDoc[]

    // We can either compute this on the fly or read from metadata.
    // Since we ran the import script, metadata should be populated.
    // However, if new documents are added, we might want to trigger a check.
    // For this dashboard, we'll return the stored metadata + a summary.

    const dashboardData = documents.map((doc: LeanStrategyDoc) => {
      const metadata = getMetadataRecord(doc.metadata)
      const aiScore = getMetadataNumber(metadata, 'reviewScore')
      const edgeCaseCount = getMetadataNumber(metadata, 'edgeCaseCount')

      return {
        id: doc._id,
        title: doc.title,
        category: doc.category,
        status: doc.status,
        source_file: getSourceFile(metadata),
        aiScore,
        technicalBacking: {
          edgeCaseCount,
          hasTechnicalProof: edgeCaseCount > 0,
        },
        aiReview: metadata?.['aiReview'] ?? null,
      }
    })

    // Calculate aggregated stats
    const totalDocs = dashboardData.length
    const provenStrategies = dashboardData.filter(
      (d) => d.technicalBacking.hasTechnicalProof,
    ).length
    const averageFeasibility =
      dashboardData.reduce((acc, curr) => acc + curr.aiScore, 0) /
      (totalDocs || 1)
    const realityGap =
      totalDocs === 0
        ? '0.0%'
        : `${((1 - provenStrategies / totalDocs) * 100).toFixed(1)}%`

    return res.json({
      overview: {
        totalStrategies: totalDocs,
        technicallyBackedStrategies: provenStrategies,
        realityGap,
        averageFeasibilityScore: averageFeasibility.toFixed(2),
      },
      data: dashboardData.sort((a, b) => b.aiScore - a.aiScore),
    })
  } catch (error: unknown) {
    console.error('Dashboard Error:', error)
    return res
      .status(500)
      .json({ error: 'Failed to generate strategy dashboard' })
  }
})

/** Returns list of imported source_file paths and last import timestamp (from import script). */
router.get('/sources', authenticateToken, (_req, res) => {
  try {
    if (!fs.existsSync(LAST_IMPORT_FILE)) {
      return res.json({ sources: [], lastImport: null })
    }
    const raw = fs.readFileSync(LAST_IMPORT_FILE, 'utf8')
    const data = JSON.parse(raw) as { sources?: string[]; lastImport?: string }
    return res.json({
      sources: Array.isArray(data.sources) ? data.sources : [],
      lastImport: typeof data.lastImport === 'string' ? data.lastImport : null,
    })
  } catch {
    return res
      .status(500)
      .json({ error: 'Failed to read strategy import metadata' })
  }
})

// Trigger a fresh re-analysis (manual refresh)
router.post('/refresh-analysis', authenticateToken, async (_req, res) => {
  try {
    const documents = await DocumentModelMongoose.find({})

    // ⚡ Bolt: Use Promise.all to fetch AI reviews and edge case mappings concurrently,
    // and replace sequential findByIdAndUpdate calls with a single bulkWrite operation to reduce N+1 queries.
    const bulkOps = await Promise.all(
      documents.map(async (doc) => {
        const idStr = doc._id.toString()
        const [review, mapping] = await Promise.all([
          AIStrategyReviewService.reviewDocument(idStr),
          EdgeCaseMappingService.mapStrategyToEdgeCases(idStr),
        ])

        return {
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $set: {
                'metadata.reviewScore': review.overallScore,
                'metadata.edgeCaseCount': mapping.mappedEdgeCases.length,
                'metadata.aiReview': review,
              },
            },
          },
        }
      }),
    )

    if (bulkOps.length > 0) {
      await DocumentModelMongoose.bulkWrite(bulkOps)
    }

    const updatedCount = bulkOps.length
    return res.json({
      message: `Successfully refreshed analysis for ${updatedCount} documents.`,
    })
  } catch {
    return res.status(500).json({ error: 'Analysis refresh failed' })
  }
})

export { router as strategyRouter }
