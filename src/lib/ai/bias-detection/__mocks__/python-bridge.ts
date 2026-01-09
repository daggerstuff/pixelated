// Vitest manual mock for PythonBiasDetectionBridge
// Provides deterministic bias scores for test sessions based on content patterns

import type { TherapeuticSession } from '../types'

function computeBiasScore(session: TherapeuticSession): number {
    const content = (session.conversationHistory || [])
        .map(m => String(m.content || '').toLowerCase())
        .join(' ')

    const CRITICAL = [
        /inherent (cultural|racial) (patterns|behaviors|tendencies)/i,
        /people from your (ethnicity|race).*struggle/i,
        /community's tendency toward/i,
        /your disability limits/i,
        /can't expect.*given your/i,
    ]

    const STRONG = [
        /biologically designed/i,
        /women are naturally/i,
        /given your (race|ethnicity|cultural background|disability)/i,
        /people like you|people from your/i,
        /at your age.*(difficult|can't|shouldn't)/i,
        /your disability.*lower.*expectations/i,
        /poor people often lack/i,
        /traditional values.*holding.*back/i,
        /you're (so articulate|well-spoken).*(for|considering|given)/i,
    ]

    const MEDIUM = [
        /(?:naturally|traditionally) (?:male|female)/i,
        /(credit to your race|impressive for)/i,
        /evidence-based western/i,
        /culturally (?:inferior|superior|appropriate)/i,
        /when you're older/i,
        /your generation('s)? (lack|problem|issue)/i,
        /(brave|inspiring).*(overcome|despite|challenges)/i,
        /financial planning skills/i,
        /naturally suited/i,
        /traditional(ly)? (male|female)(-dominated)?/i,
        /might be more (suited|appropriate)/i,
        /(can't|cannot) (access|afford).*quality/i,
        /probably (can't|cannot)/i,
        /(?:lack of|need more).*experience/i,
        /typical for your generation/i,
    ]

    const SUBTLE = [
        'traditional field', 'typical for', 'cultural practice',
        'your background', 'have you considered',
    ]

    let score = 0.05
    let critical = 0
    let strong = 0
    let medium = 0
    let subtle = 0

    for (const p of CRITICAL) if (p.test(content)) critical++
    for (const p of STRONG) if (p.test(content)) strong++
    for (const p of MEDIUM) if (p.test(content)) medium++
    for (const k of SUBTLE) if (content.includes(k.toLowerCase())) subtle++

    if (critical > 0) {
        score = Math.min(0.95, 0.85 + critical * 0.05)
    } else if (strong > 0) {
        score = Math.min(0.85, 0.70 + strong * 0.08)
    } else if (medium > 0) {
        score = Math.min(0.70, 0.45 + medium * 0.12)
    } else if (subtle >= 2) {
        score = Math.min(0.50, 0.30 + subtle * 0.08)
    } else if (subtle === 1) {
        score = 0.20
    } else {
        score = 0.05
    }

    return Math.max(0, Math.min(1, score))
}

export class PythonBiasDetectionBridge {
    url: string
    timeoutMs: number

    constructor(url: string = 'http://localhost:5000', timeoutMs: number = 30000) {
        this.url = url
        this.timeoutMs = timeoutMs
    }

    async initialize(): Promise<void> {
        // no-op in mock
    }

    async runPreprocessingAnalysis(session: TherapeuticSession): Promise<any> {
        const score = computeBiasScore(session)
        return { biasScore: score, layer: 'preprocessing' }
    }

    async runModelLevelAnalysis(session: TherapeuticSession): Promise<any> {
        const score = computeBiasScore(session)
        return { biasScore: score, layer: 'model_level', metrics: { performance_metrics: { accuracy: 0.9, precision: 0.9, recall: 0.9 } } }
    }

    async runInteractiveAnalysis(session: TherapeuticSession): Promise<any> {
        const score = computeBiasScore(session)
        return { biasScore: score, layer: 'interactive', metrics: { counterfactual_analysis: { bias_detected: score > 0.3 } } }
    }

    async runEvaluationAnalysis(session: TherapeuticSession): Promise<any> {
        const score = computeBiasScore(session)
        return { biasScore: score, layer: 'evaluation', metrics: { hugging_face_metrics: { bias: score } } }
    }

    async checkHealth(): Promise<{ status: 'healthy'; message: string; timestamp: string }> {
        return { status: 'healthy', message: 'mock', timestamp: new Date().toISOString() }
    }

    stopHealthMonitoring(): void { }
    getHealthStatus(): { status: string; lastCheck: Date; consecutiveFailures: number } {
        return { status: 'healthy', lastCheck: new Date(), consecutiveFailures: 0 }
    }
    getMetrics() { return {} }
    async dispose(): Promise<void> { }
}
