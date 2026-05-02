import { describe, it, expect } from 'vitest'
<<<<<<< HEAD

import { analyzeTherapeuticTechniques } from '../speechRecognition'
=======
import { analyzeTherapeuticTechniques, getTherapeuticPrompts } from '../speechRecognition'
>>>>>>> 1ed0e6a0f (🧪 QA: Add test for getTherapeuticPrompts edge case)

describe('analyzeTherapeuticTechniques', () => {
  it('returns empty object when no therapeutic techniques are detected', () => {
    const result = analyzeTherapeuticTechniques(
      'just a normal conversation without any therapeutic patterns',
    )
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
    expect(validPrompts.includes(prompts[0])).toBe(true)
  })
})
