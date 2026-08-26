import { describe, it, expect } from 'vitest'

import {
  analyzeTherapeuticTechniques,
  getTherapeuticPrompts,
  processRecognizedSpeech,
} from '../speechRecognition'

describe('processRecognizedSpeech', () => {
  it('handles empty string gracefully', () => {
    const result = processRecognizedSpeech('', 'depression')
    expect(result.processedText).toBe('')
    expect(result.detectedKeywords).toEqual([])
    expect(result.confidenceScores).toEqual({})
  })

  it('cleans up whitespace and filler words', () => {
    // Only tests what the regex currently supports (removing single leading filler word)
    const result = processRecognizedSpeech('  um   I feel sad   ', 'depression')
    expect(result.processedText).toBe('I feel sad')
    expect(result.detectedKeywords).toContain('sad')
    expect(result.confidenceScores).toHaveProperty('sad')
    expect(result.confidenceScores['sad']).toBeGreaterThanOrEqual(0.7)
    expect(result.confidenceScores['sad']).toBeLessThanOrEqual(1.0)
  })
})

describe('analyzeTherapeuticTechniques', () => {
  it('returns empty object when no therapeutic techniques are detected', () => {
    const result = analyzeTherapeuticTechniques(
      'just a normal conversation without any therapeutic patterns',
    )
    expect(result).toEqual({})
  })

  it('detects single and multiple techniques with proper confidence scoring', () => {
    // Tests reflection pattern: "it sounds like you're feeling"
    // Plus open_question pattern: "how do you cope?"
    const result = analyzeTherapeuticTechniques(
      "It sounds like you're feeling anxious, how do you cope with that?",
    )
    expect(result).toHaveProperty('reflection')
    // 0.7 base + 0.3 * (1/3 reflection patterns matched) = 0.8
    expect(result['reflection']).toBeCloseTo(0.8, 1)

    expect(result).toHaveProperty('open_question')
    // 0.7 base + 0.3 * (1/4 open_question patterns matched) = 0.775
    expect(result['open_question']).toBeCloseTo(0.775, 3)
  })
})

describe('getTherapeuticPrompts', () => {
  it('returns domain-specific general prompts when detectedKeywords is empty', () => {
    const prompts = getTherapeuticPrompts([], 'anxiety')
    expect(prompts.length).toBeGreaterThan(0)
    // Check if the prompt is from the anxiety general prompts
    const validPrompts = [
      'How has anxiety been affecting you lately?',
      'What situations typically trigger your anxiety?',
    ]
    expect(prompts.every((p) => validPrompts.includes(p))).toBe(true)
  })
})
