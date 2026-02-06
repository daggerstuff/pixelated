// import { Document } from '@/types/document'
import { DocumentModel } from '@/models/Document'

export interface StrategyReview {
    documentId: string
    reviewDate: Date
    overallScore: number // 0-1
    strengths: string[]
    weaknesses: string[]
    logicalGaps: string[]
    marketConsistency: string // 'high' | 'medium' | 'low'
    recommendations: string[]
}

export class AIStrategyReviewService {
    /**
     * Performs an AI-driven review of a strategy document.
     * In a real implementation, this would call an LLM (e.g., GPT-4o) 
     * with the document content and market context.
     */
    static async reviewDocument(documentId: string): Promise<StrategyReview> {
        const document = await DocumentModel.findById(documentId)
        if (!document) {
            throw new Error('Document not found')
        }

        // Mock AI Analysis Logic
        // This simulates what an LLM would return
        const content = document.content.toLowerCase()

        const review: StrategyReview = {
            documentId,
            reviewDate: new Date(),
            overallScore: 0.85,
            strengths: [],
            weaknesses: [],
            logicalGaps: [],
            marketConsistency: 'high',
            recommendations: []
        }

        // Heuristics-based mock analysis
        if (content.includes('competitive advantage') || content.includes('differentiator')) {
            review.strengths.push('Strong focus on competitive positioning')
        } else {
            review.weaknesses.push('Lacks clear competitive differentiation')
        }

        if (content.includes('market size') && content.includes('growth')) {
            review.strengths.push('Evidence-based market analysis included')
        } else {
            review.logicalGaps.push('Missing quantification of total addressable market (TAM)')
        }

        if (content.includes('risk') || content.includes('mitigation')) {
            review.strengths.push('Comprehensive risk management framework')
        } else {
            review.recommendations.push('Develop a detailed risk mitigation strategy')
        }

        if (document.category === 'executive_summary') {
            review.overallScore = content.length > 2000 ? 0.9 : 0.7
        }

        return review
    }

    /**
     * Reviews all documents in a specific category and provides a cross-document coherence check.
     */
    static async performCrossReview(category: string): Promise<{
        coherenceScore: number
        contradictions: string[]
        missingLinks: string[]
    }> {
        const documents = await DocumentModel.findAll({ category })

        // Simulating cross-document analysis
        return {
            coherenceScore: documents.length > 5 ? 0.88 : 0.6,
            contradictions: documents.length === 0 ? [] : ['None detected across current set'],
            missingLinks: documents.length < 3 ? ['Insufficient inter-document referencing'] : []
        }
    }
}
