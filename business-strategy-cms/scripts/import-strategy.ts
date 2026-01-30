import fs from 'fs'
import path from 'path'
import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
import matter from 'gray-matter'
import { DocumentModelMongoose } from '../src/models/DocumentMongoose'
import { DocumentCategory, DocumentStatus } from '../src/types/document'
import { AIStrategyReviewService } from '../src/services/aiStrategyReviewService'
import { EdgeCaseMappingService } from '../src/services/edgeCaseMappingService'

dotenv.config()

const STRATEGY_DIR = path.join(__dirname, '../../business-strategy')
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://admin:password@127.0.0.1:27017/business-strategy-cms?authSource=admin'

async function importStrategy() {
    try {
        console.log('Connecting to MongoDB...')
        try {
            await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
            console.log('Connected to MongoDB.')
        } catch (connErr: any) {
            console.error('Failed to connect to MongoDB.')
            if (connErr.name === 'MongooseServerSelectionError') {
                console.error('Timeout: Could not connect to server. Please check your IP Whitelist in MongoDB Atlas.')
                console.error('Current IP appears to be: 174.207.230.209 (or similar)')
            }
            throw connErr
        }

        const files = fs.readdirSync(STRATEGY_DIR)
        const markdownFiles = files.filter(f => f.endsWith('.md') && f !== 'README.md')

        console.log(`Found ${markdownFiles.length} strategy documents to import.`)

        const systemUserId = '00000000-0000-0000-0000-000000000000'

        for (const file of markdownFiles) {
            const filePath = path.join(STRATEGY_DIR, file)
            const content = fs.readFileSync(filePath, 'utf8')

            const { data: frontmatter, content: bodyContent } = matter(content)

            // Basic title extraction from frontmatter or first line starting with #
            const titleMatch = bodyContent.match(/^#\s+(.+)$/m)
            const title = frontmatter.title || (titleMatch ? titleMatch[1] : file.replace('.md', ''))

            // Determine category based on frontmatter, filename or content
            let category = frontmatter.category || DocumentCategory.BUSINESS_PLAN
            if (!frontmatter.category) {
                if (file.includes('market')) category = DocumentCategory.MARKET_ANALYSIS
                if (file.includes('marketing')) category = DocumentCategory.MARKETING_STRATEGY
                if (file.includes('sales')) category = DocumentCategory.MARKETING_STRATEGY
                if (file.includes('summary')) category = DocumentCategory.EXECUTIVE_SUMMARY
            }

            const wordCount = bodyContent.split(/\s+/).length
            const readingTime = Math.ceil(wordCount / 200)

            const docData = {
                title,
                content: bodyContent.trim(),
                summary: frontmatter.summary || `Imported from ${file}`,
                category,
                tags: frontmatter.tags || ['imported', 'strategy', 'v1'],
                status: frontmatter.status || DocumentStatus.PUBLISHED,
                authorId: frontmatter.authorId || systemUserId,
                collaborators: frontmatter.collaborators || [],
                version: frontmatter.version || 1,
                metadata: {
                    wordCount,
                    readingTime,
                    lastEditedBy: systemUserId,
                    fileSize: Buffer.byteLength(bodyContent),
                    mimeType: 'text/markdown',
                    customFields: new Map([
                        ['source_file', file],
                        ...Object.entries(frontmatter).filter(([k]) => ![
                            'title', 'category', 'summary', 'tags', 'status', 'authorId', 'collaborators', 'version'
                        ].includes(k))
                    ])
                }
            }

            // Check if document already exists by title
            const existing = await DocumentModelMongoose.findOne({ title })
            if (existing) {
                console.log(`Updating existing document: ${title}`)
                await DocumentModelMongoose.findByIdAndUpdate(existing._id, docData)
            } else {
                console.log(`Creating new document: ${title}`)
                await DocumentModelMongoose.create(docData)
            }
        }

        console.log('Import completed successfully.')

        console.log('Starting Post-Import AI Analysis...')
        const allDocs = await DocumentModelMongoose.find({})
        for (const doc of allDocs) {
            const review = await AIStrategyReviewService.reviewDocument(doc._id.toString())
            const mapping = await EdgeCaseMappingService.mapStrategyToEdgeCases(doc._id.toString())

            console.log(`- Reviewed: ${doc.title} (Score: ${review.overallScore})`)
            console.log(`  - Mapped to ${mapping.mappedEdgeCases.length} technical edge cases.`)

            // Store results in metadata (optional but recommended for current system)
            await DocumentModelMongoose.findByIdAndUpdate(doc._id, {
                $set: {
                    'metadata.reviewScore': review.overallScore,
                    'metadata.edgeCaseCount': mapping.mappedEdgeCases.length,
                    'metadata.aiReview': review
                }
            })
        }
        console.log('Post-Import Analysis Completed.')
    } catch (error) {
        console.error('Import failed:', error)
    } finally {
        await mongoose.connection.close()
    }
}

importStrategy().catch(err => {
    console.error('Import process failed:', err)
    process.exit(1)
})
