import { describe, it, expect } from 'vitest'

import { analyzeTherapeuticTechniques } from '../speechRecognition'

describe('analyzeTherapeuticTechniques', () => {
  it('returns empty object when no therapeutic techniques are detected', () => {
    const result = analyzeTherapeuticTechniques(
      'just a normal conversation without any therapeutic patterns',
    )
    expect(result).toEqual({})
  })
})
