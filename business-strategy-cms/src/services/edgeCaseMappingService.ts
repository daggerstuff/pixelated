import fs from 'fs'
import path from 'path'
import { DocumentModel } from '@/models/Document'

export interface EdgeCaseMap {
    strategyDocumentId: string
    strategyTitle: string
    mappedEdgeCases: Array<{
        filePath: string
        fileName: string
        relevanceScore: number
        connectionReason: string
    }>
}

export class EdgeCaseMappingService {
    private static readonly EDGE_CASE_DIRS = [
        '/home/vivi/pixelated/ai/training_ready/data/generated/edge_case_expanded',
        '/home/vivi/pixelated/ai/integration_pipeline/training_data_consolidated/edge_cases_enhanced'
    ]

    /**
     * Maps strategy documents to technical AI edge cases based on keyword matching.
     */
    static async mapStrategyToEdgeCases(documentId: string): Promise<EdgeCaseMap> {
        const document = await DocumentModel.findById(documentId)
        if (!document) {
            throw new Error('Document not found')
        }

        const mapping: EdgeCaseMap = {
            strategyDocumentId: documentId,
            strategyTitle: document.title,
            mappedEdgeCases: []
        }

        const keywords = this.extractKeywords(document.content)

        for (const dir of this.EDGE_CASE_DIRS) {
            if (!fs.existsSync(dir)) continue

            const files = fs.readdirSync(dir)
            for (const file of files) {
                if (!file.endsWith('.json') && !file.endsWith('.jsonl')) continue

                const relevance = this.calculateRelevance(file, keywords)
                if (relevance.score > 0.3) {
                    mapping.mappedEdgeCases.push({
                        filePath: path.join(dir, file),
                        fileName: file,
                        relevanceScore: relevance.score,
                        connectionReason: relevance.reason
                    })
                }
            }
        }

        // Sort by relevance
        mapping.mappedEdgeCases.sort((a, b) => b.relevanceScore - a.relevanceScore)

        return mapping
    }

    private static extractKeywords(content: string): string[] {
        const commonWords = ['the', 'and', 'strategy', 'pixelated', 'empathy', 'platform']
        return content.toLowerCase()
            .split(/\W+/)
            .filter(w => w.length > 4 && !commonWords.includes(w))
            .slice(0, 50)
    }

    private static calculateRelevance(fileName: string, keywords: string[]): { score: number, reason: string } {
        const name = fileName.toLowerCase()
        let matches = 0
        let matchedKeywords: string[] = []

        for (const kw of keywords) {
            if (name.includes(kw)) {
                matches++
                matchedKeywords.push(kw)
            }
        }

        if (name.includes('crisis') && keywords.includes('safety')) matches += 2
        if (name.includes('suicide') && keywords.includes('intervention')) matches += 2

        const score = Math.min(matches / 5, 1)
        return {
            score,
            reason: matches > 0 ? `Matches keywords: ${matchedKeywords.join(', ')}` : 'Low relevance'
        }
    }
}
