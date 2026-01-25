import { describe, it, expect } from 'vitest'
import { detectCrisisSignals } from '../crisis-detection'

describe('CrisisDetectionService', () => {
    it('detects imminent self-harm risk', () => {
        const text = 'I am going to kill myself tonight, I have the pills ready.'
        const result = detectCrisisSignals(text)
        expect(result.hasCrisisSignal).toBe(true)
        expect(result.riskLevel).toBe('imminent')
        expect(result.actionRequired).toBe(true)
        expect(result.escalationProtocol[0]).toContain('emergency services')
    })

    it('detects high-risk despair and hopelessness', () => {
        const text = 'I have no hope left, everything is dark and I just want it to end.'
        const result = detectCrisisSignals(text)
        expect(result.hasCrisisSignal).toBe(true)
        expect(['moderate', 'high', 'imminent']).toContain(result.riskLevel)
        expect(result.signals.some(s => s.category === 'despair')).toBe(true)
    })

    it('detects moderate medical urgency', () => {
        const text = 'I can\'t breathe and having chest pain.'
        const result = detectCrisisSignals(text)
        expect(result.hasCrisisSignal).toBe(true)
        expect(result.signals.some(s => s.category === 'medical')).toBe(true)
    })

    it('returns minimal risk for normal conversation', () => {
        const text = 'I had a really good day at work and feeling much better now.'
        const result = detectCrisisSignals(text)
        expect(result.riskLevel).toBe('minimal')
        expect(result.hasCrisisSignal).toBe(false)
    })

    it('handles empty input', () => {
        const result = detectCrisisSignals('')
        expect(result.hasCrisisSignal).toBe(false)
        expect(result.riskLevel).toBe('minimal')
    })
})
