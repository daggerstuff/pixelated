import { describe, it, expect } from 'vitest'
import { CrisisDetectionService } from '../../src/lib/ai/services/crisis-detection'

// Minimal AI service stub; performAIAnalysis will fallback to null
const aiStub: any = {}

function makeService(sensitivity: 'low' | 'medium' | 'high' = 'medium') {
    return new CrisisDetectionService({ aiService: aiStub, sensitivityLevel: sensitivity })
}

describe('Crisis Detection – Cultural & Idiomatic Edge Cases', () => {
    it('should not flag "We killed it at the show" as crisis', async () => {
        const svc = makeService()
        const res = await svc.detectCrisis('We absolutely killed it at the show last night!', {
            sensitivityLevel: 'medium',
            userId: 't1',
            source: 'unit-test',
        })
        expect(res.isCrisis).toBe(false)
        expect(res.riskLevel === 'low' || res.riskLevel === 'medium').toBe(true)
    })

    it('should not flag "I\'m dying to see you" as crisis', async () => {
        const svc = makeService()
        const res = await svc.detectCrisis("I'm dying to see you this weekend!", {
            sensitivityLevel: 'medium',
            userId: 't1',
            source: 'unit-test',
        })
        expect(res.isCrisis).toBe(false)
    })

    it('should not flag Suicide Squad movie reference as crisis', async () => {
        const svc = makeService()
        const res = await svc.detectCrisis('We watched Suicide Squad last night. Fun soundtrack.', {
            sensitivityLevel: 'medium',
            userId: 't1',
            source: 'unit-test',
        })
        expect(res.isCrisis).toBe(false)
    })

    it('should not flag academic discussion: reading about suicide', async () => {
        const svc = makeService()
        const res = await svc.detectCrisis('I was reading about suicide prevention for a class project.', {
            sensitivityLevel: 'medium',
            userId: 't1',
            source: 'unit-test',
        })
        expect(res.isCrisis).toBe(false)
    })

    it('should still detect genuine suicidal statement', async () => {
        const svc = makeService()
        const res = await svc.detectCrisis('I want to kill myself tonight', {
            sensitivityLevel: 'medium',
            userId: 't1',
            source: 'unit-test',
        })
        expect(res.isCrisis).toBe(true)
        expect(res.urgency === 'immediate' || res.urgency === 'high').toBe(true)
    })

    it('should detect euphemism "unalive myself" as crisis', async () => {
        const svc = makeService()
        const res = await svc.detectCrisis('Sometimes I think I might unalive myself.', {
            sensitivityLevel: 'medium',
            userId: 't1',
            source: 'unit-test',
        })
        expect(res.isCrisis).toBe(true)
    })
})
