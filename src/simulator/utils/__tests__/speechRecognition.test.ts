import { describe, it, expect } from 'vitest'
import { analyzeTherapeuticTechniques, getTherapeuticPrompts } from '../speechRecognition'

describe('analyzeTherapeuticTechniques', () => {
  it('returns empty object when no therapeutic techniques are detected', () => {
    const result = analyzeTherapeuticTechniques('just a normal conversation without any therapeutic patterns')
    expect(result).toEqual({})
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

  it('returns fallback general prompts when domain is unrecognized', () => {
    const prompts = getTherapeuticPrompts([], 'unrecognized_domain')
    expect(prompts.length).toBeGreaterThan(0)
    // Check if the prompt is from the general prompts fallback
    const validPrompts = [
      'Could you tell me more about that?',
      'How does that affect you day to day?',
    ]
    expect(prompts.every((p) => validPrompts.includes(p))).toBe(true)
  })
})
