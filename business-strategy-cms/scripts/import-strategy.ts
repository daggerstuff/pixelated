import fs from 'fs'
import path from 'path'

import * as dotenv from 'dotenv'
import matter from 'gray-matter'
import mongoose from 'mongoose'

import { DocumentModelMongoose } from '../src/models/DocumentMongoose'
import { AIStrategyReviewService } from '../src/services/aiStrategyReviewService'
import { EdgeCaseMappingService } from '../src/services/edgeCaseMappingService'
import { DocumentCategory, DocumentStatus } from '../src/types/document'

dotenv.config()

const STRATEGY_DIR = path.join(__dirname, '../../business-strategy')
const MONGO_URI =
  process.env.MONGODB_URI ||
  'mongodb://admin:password@127.0.0.1:27017/business-strategy-cms?authSource=admin'
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'

/** Collect all .md file paths under dir, relative to STRATEGY_DIR. Excludes README.md at root. */
function collectMarkdownPaths(
  dir: string,
  baseDir: string,
  acc: string[] = [],
): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    const relative = path.relative(baseDir, full).replace(/\\/g, '/')
    if (e.isDirectory()) {
      collectMarkdownPaths(full, baseDir, acc)
    } else if (e.isFile() && e.name.endsWith('.md')) {
      if (relative === 'README.md') continue
      acc.push(relative)
    }
  }
  return acc
}

/** Phase 1: Connect to MongoDB. */
async function connectDb(): Promise<void> {
  console.log('Connecting to MongoDB...')
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
    console.log('Connected to MongoDB.')
  } catch (connErr: unknown) {
    console.error('Failed to connect to MongoDB.')
    const err = connErr as { name?: string }
    if (err.name === 'MongooseServerSelectionError') {
      console.error(
        'Timeout: Could not connect to server. Please check your IP Whitelist in MongoDB Atlas.',
      )
      console.error('Current IP appears to be: 174.207.230.209 (or similar)')
    }
    throw connErr
  }
}

/** Phase 2: Parse a single strategy file into document payload (no DB). sourceFile is path relative to STRATEGY_DIR (e.g. outreach/stanford-pilot-proposal.md). */
function parseStrategyFile(
  sourceFile: string,
  content: string,
): Record<string, unknown> {
  const { data: frontmatter, content: bodyContent } = matter(content)
  const baseName = path.basename(sourceFile, '.md')

  const titleMatch = bodyContent.match(/^#\s+(.+)$/m)
  const title =
    typeof frontmatter.title === 'string'
      ? frontmatter.title
      : titleMatch
        ? titleMatch[1]
        : baseName

  let category = frontmatter.category || DocumentCategory.BUSINESS_PLAN
  if (!frontmatter.category) {
    if (sourceFile.startsWith('outreach/') || sourceFile.startsWith('pilot-operations/')) {
      category = DocumentCategory.OPERATIONS_PLAN
    } else if (sourceFile.includes('market')) {
      category = DocumentCategory.MARKET_ANALYSIS
    } else if (sourceFile.includes('marketing') || sourceFile.includes('sales')) {
      category = DocumentCategory.MARKETING_STRATEGY
    } else if (sourceFile.includes('summary')) {
      category = DocumentCategory.EXECUTIVE_SUMMARY
    }
  }

  const wordCount = bodyContent.split(/\s+/).length
  const readingTime = Math.ceil(wordCount / 200)

  return {
    title,
    content: bodyContent.trim(),
    summary: frontmatter.summary || `Imported from ${sourceFile}`,
    category,
    tags: frontmatter.tags || ['imported', 'strategy', 'v1'],
    status: frontmatter.status || DocumentStatus.PUBLISHED,
    authorId: frontmatter.authorId || SYSTEM_USER_ID,
    collaborators: frontmatter.collaborators || [],
    version: frontmatter.version || 1,
    metadata: {
      wordCount,
      readingTime,
      lastEditedBy: SYSTEM_USER_ID,
      fileSize: Buffer.byteLength(bodyContent),
      mimeType: 'text/markdown',
      customFields: new Map([
        ['source_file', sourceFile],
        ...Object.entries(frontmatter).filter(
          ([k]) =>
            ![
              'title',
              'category',
              'summary',
              'tags',
              'status',
              'authorId',
              'collaborators',
              'version',
            ].includes(k),
        ),
      ]),
    },
  }
}

/** Phase 3: Persist one document (create or update by source_file for idempotency). */
async function persistDocument(
  docData: Record<string, unknown>,
): Promise<void> {
  const metadata = docData.metadata as Record<string, unknown>
  const customFields = metadata?.customFields as Map<string, unknown> | undefined
  const sourceFile = customFields?.get('source_file') as string | undefined
  const title = docData.title as string

  const existing = sourceFile
    ? await DocumentModelMongoose.findOne({
        'metadata.customFields.source_file': sourceFile,
      })
    : await DocumentModelMongoose.findOne({ title })

  if (existing) {
    console.log(`Updating existing document: ${title} (${sourceFile ?? 'no source_file'})`)
    await DocumentModelMongoose.findByIdAndUpdate(existing._id, docData)
  } else {
    console.log(`Creating new document: ${title} (${sourceFile ?? 'no source_file'})`)
    await DocumentModelMongoose.create(docData)
  }
}

/** Phase 4: Run post-import AI analysis on all documents and update metadata. */
async function runPostImportAnalysis(): Promise<void> {
  console.log('Starting Post-Import AI Analysis...')
  const allDocs = await DocumentModelMongoose.find({})
  for (const doc of allDocs) {
    const review = await AIStrategyReviewService.reviewDocument(
      doc._id.toString(),
    )
    const mapping = await EdgeCaseMappingService.mapStrategyToEdgeCases(
      doc._id.toString(),
    )

    console.log(`- Reviewed: ${doc.title} (Score: ${review.overallScore})`)
    console.log(
      `  - Mapped to ${mapping.mappedEdgeCases.length} technical edge cases.`,
    )

    await DocumentModelMongoose.findByIdAndUpdate(doc._id, {
      $set: {
        'metadata.reviewScore': review.overallScore,
        'metadata.edgeCaseCount': mapping.mappedEdgeCases.length,
        'metadata.aiReview': review,
      },
    })
  }
  console.log('Post-Import Analysis Completed.')
}

/** Orchestrates the full import pipeline: connect, parse, persist, analyze. */
async function importStrategy() {
  try {
    await connectDb()

    const markdownPaths = collectMarkdownPaths(STRATEGY_DIR, STRATEGY_DIR)
    console.log(`Found ${markdownPaths.length} strategy documents to import.`)

    for (const relativePath of markdownPaths) {
      const filePath = path.join(STRATEGY_DIR, relativePath)
      const content = fs.readFileSync(filePath, 'utf8')
      const docData = parseStrategyFile(relativePath, content)
      await persistDocument(docData)
    }

    console.log('Import completed successfully.')

    const lastImportPath = path.join(__dirname, '..', '.last-strategy-import.json')
    fs.writeFileSync(
      lastImportPath,
      JSON.stringify(
        { sources: markdownPaths, lastImport: new Date().toISOString() },
        null,
        2,
      ),
      'utf8',
    )
    console.log(`Wrote last import metadata to ${lastImportPath}.`)

    await runPostImportAnalysis()
  } catch (error) {
    console.error('Import failed:', error)
  } finally {
    await mongoose.connection.close()
  }
}

importStrategy().catch((err) => {
  console.error('Import process failed:', err)
  process.exit(1)
})
