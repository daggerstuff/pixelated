import {
  CORE_MENTAL_HEALTH_OBJECTIVES,
  ObjectiveDefinition,
  AlignmentContext,
  ContextType,
  getObjectiveById,
  getAllObjectives,
  validateObjectiveWeights,
  getDefaultObjectiveWeights,
} from './objectives'

describe('Core Mental Health Objectives', () => {
  describe('Objective Definitions', () => {
    test('should have exactly 5 core objectives', () => {
      expect(CORE_MENTAL_HEALTH_OBJECTIVES).toHaveLength(5)
    })

    test('should contain all expected objective IDs', () => {
      const expectedIds = [
        'correctness',
        'informativeness',
        'professionalism',
        'empathy',
        'safety',
      ]
      const actualIds = CORE_MENTAL_HEALTH_OBJECTIVES.map((obj) => obj.id)
      expect(actualIds.sort()).toEqual(expectedIds.sort())
    })

    test('should have valid weight distribution', () => {
      const totalWeight = CORE_MENTAL_HEALTH_OBJECTIVES.reduce(
        (sum, obj) => sum + obj.weight,
        0,
      )
      expect(totalWeight).toBeCloseTo(1.0, 3)
    })

    test('each objective should have required properties', () => {
      CORE_MENTAL_HEALTH_OBJECTIVES.forEach((objective) => {
        expect(objective).toHaveProperty('id')
        expect(objective).toHaveProperty('name')
        expect(objective).toHaveProperty('description')
        expect(objective).toHaveProperty('weight')
        expect(objective).toHaveProperty('criteria')
        expect(objective).toHaveProperty('evaluationFunction')

        expect(typeof objective.id).toBe('string')
        expect(typeof objective.name).toBe('string')
        expect(typeof objective.description).toBe('string')
        expect(typeof objective.weight).toBe('number')
        expect(Array.isArray(objective.criteria)).toBe(true)
        expect(typeof objective.evaluationFunction).toBe('function')
      })
    })

    test('each objective should have valid criteria', () => {
      CORE_MENTAL_HEALTH_OBJECTIVES.forEach((objective) => {
        expect(objective.criteria.length).toBeGreaterThan(0)

        const totalCriteriaWeight = objective.criteria.reduce(
          (sum, criterion) => sum + criterion.weight,
          0,
        )
        expect(totalCriteriaWeight).toBeCloseTo(1.0, 3)

        objective.criteria.forEach((criterion) => {
          expect(criterion).toHaveProperty('criterion')
          expect(criterion).toHaveProperty('description')
          expect(criterion).toHaveProperty('weight')
          expect(typeof criterion.criterion).toBe('string')
          expect(typeof criterion.description).toBe('string')
          expect(typeof criterion.weight).toBe('number')
          expect(criterion.weight).toBeGreaterThan(0)
          expect(criterion.weight).toBeLessThanOrEqual(1)
        })
      })
    })
  })

  describe('Specific Objectives', () => {
    test('correctness objective should have proper structure', () => {
      const correctness = getObjectiveById('correctness')
      expect(correctness).toBeDefined()
      expect(correctness!.name).toBe('Correctness')
      expect(correctness!.weight).toBe(0.25)
      expect(correctness!.criteria).toHaveLength(3)

      const criteriaIds = correctness!.criteria.map((c) => c.criterion)
      expect(criteriaIds).toContain('factual_accuracy')
      expect(criteriaIds).toContain('evidence_based')
      expect(criteriaIds).toContain('clinical_soundness')
    })

    test('informativeness objective should have proper structure', () => {
      const informativeness = getObjectiveById('informativeness')
      expect(informativeness).toBeDefined()
      expect(informativeness!.name).toBe('Informativeness')
      expect(informativeness!.weight).toBe(0.2)
      expect(informativeness!.criteria).toHaveLength(3)

      const criteriaIds = informativeness!.criteria.map((c) => c.criterion)
      expect(criteriaIds).toContain('comprehensiveness')
      expect(criteriaIds).toContain('relevance')
      expect(criteriaIds).toContain('actionability')
    })

    test('professionalism objective should have proper structure', () => {
      const professionalism = getObjectiveById('professionalism')
      expect(professionalism).toBeDefined()
      expect(professionalism!.name).toBe('Professionalism')
      expect(professionalism!.weight).toBe(0.2)
      expect(professionalism!.criteria).toHaveLength(3)

      const criteriaIds = professionalism!.criteria.map((c) => c.criterion)
      expect(criteriaIds).toContain('clinical_tone')
      expect(criteriaIds).toContain('boundaries')
      expect(criteriaIds).toContain('ethical_standards')
    })

    test('empathy objective should have proper structure', () => {
      const empathy = getObjectiveById('empathy')
      expect(empathy).toBeDefined()
      expect(empathy!.name).toBe('Empathy')
      expect(empathy!.weight).toBe(0.2)
      expect(empathy!.criteria).toHaveLength(3)

      const criteriaIds = empathy!.criteria.map((c) => c.criterion)
      expect(criteriaIds).toContain('emotional_validation')
      expect(criteriaIds).toContain('understanding_demonstration')
      expect(criteriaIds).toContain('supportive_tone')
    })

    test('safety objective should have proper structure', () => {
      const safety = getObjectiveById('safety')
      expect(safety).toBeDefined()
      expect(safety!.name).toBe('Safety')
      expect(safety!.weight).toBe(0.15)
      expect(safety!.criteria).toHaveLength(3)

      const criteriaIds = safety!.criteria.map((c) => c.criterion)
      expect(criteriaIds).toContain('harm_prevention')
      expect(criteriaIds).toContain('crisis_recognition')
      expect(criteriaIds).toContain('resource_provision')
    })
  })

  describe('Evaluation Functions', () => {
    const mockContext: AlignmentContext = {
      userQuery: 'I feel anxious about my upcoming job interview',
      detectedContext: ContextType.SUPPORT,
      conversationHistory: [],
      userProfile: {
        demographics: { age: 28 },
        preferences: { communicationStyle: 'empathetic' },
      },
    }

    const mockResponse =
      "It's completely normal to feel anxious before an important interview. This shows that the opportunity matters to you. Here are some evidence-based strategies that can help: practice deep breathing exercises, prepare answers to common questions, and remember that some nervousness can actually improve performance. If you'd like, I can guide you through a brief relaxation technique."

    test('evaluation functions should return scores between 0 and 1', () => {
      CORE_MENTAL_HEALTH_OBJECTIVES.forEach((objective) => {
        const score = objective.evaluationFunction(mockResponse, mockContext)
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(1)
        expect(typeof score).toBe('number')
      })
    })

    test('correctness evaluation should work', () => {
      const correctness = getObjectiveById('correctness')!
      const score = correctness.evaluationFunction(mockResponse, mockContext)
      expect(score).toBeGreaterThan(0.5) // Should score reasonably well for a good response
    })

    test('informativeness evaluation should work', () => {
      const informativeness = getObjectiveById('informativeness')!
      const score = informativeness.evaluationFunction(
        mockResponse,
        mockContext,
      )
      expect(score).toBeGreaterThan(0.5)
    })

    test('professionalism evaluation should work', () => {
      const professionalism = getObjectiveById('professionalism')!
      const score = professionalism.evaluationFunction(
        mockResponse,
        mockContext,
      )
      expect(score).toBeGreaterThan(0.5)
    })

    test('empathy evaluation should work', () => {
      const empathy = getObjectiveById('empathy')!
      const score = empathy.evaluationFunction(mockResponse, mockContext)
      expect(score).toBeGreaterThan(0.5)
    })

    test('safety evaluation should work', () => {
      const safety = getObjectiveById('safety')!
      const score = safety.evaluationFunction(mockResponse, mockContext)
      expect(score).toBeGreaterThan(0.8) // Safety should score high for non-harmful response
    })
  })

  describe('Utility Functions', () => {
    test('getObjectiveById should return correct objective', () => {
      const correctness = getObjectiveById('correctness')
      expect(correctness).toBeDefined()
      expect(correctness!.id).toBe('correctness')
      expect(correctness!.name).toBe('Correctness')
    })

    test('getObjectiveById should return undefined for invalid ID', () => {
      const invalid = getObjectiveById('invalid_id')
      expect(invalid).toBeUndefined()
    })

    test('getAllObjectives should return all objectives', () => {
      const allObjectives = getAllObjectives()
      expect(allObjectives).toHaveLength(5)
      expect(allObjectives).toEqual(CORE_MENTAL_HEALTH_OBJECTIVES)

      // Ensure it returns a copy, not the original array
      allObjectives.push({} as ObjectiveDefinition)
      expect(CORE_MENTAL_HEALTH_OBJECTIVES).toHaveLength(5)
    })

    test('validateObjectiveWeights should return true for valid weights', () => {
      expect(validateObjectiveWeights()).toBe(true)
    })

    test('getDefaultObjectiveWeights should return correct weights', () => {
      const weights = getDefaultObjectiveWeights()
      expect(weights).toEqual({
        correctness: 0.25,
        informativeness: 0.2,
        professionalism: 0.2,
        empathy: 0.2,
        safety: 0.15,
      })

      const totalWeight = Object.values(weights).reduce(
        (sum, weight) => sum + weight,
        0,
      )
      expect(totalWeight).toBeCloseTo(1.0, 3)
    })
  })

  describe('Context Types', () => {
    test('ContextType enum should have all expected values', () => {
      expect(ContextType.CRISIS).toBe('crisis')
      expect(ContextType.EDUCATIONAL).toBe('educational')
      expect(ContextType.SUPPORT).toBe('support')
      expect(ContextType.CLINICAL_ASSESSMENT).toBe('clinical_assessment')
      expect(ContextType.INFORMATIONAL).toBe('informational')
      expect(ContextType.GENERAL).toBe('general')
    })
  })

  describe('AlignmentContext Interface', () => {
    test('should accept valid context objects', () => {
      const context: AlignmentContext = {
        userQuery: 'Test query',
        detectedContext: ContextType.GENERAL,
      }
      expect(context.userQuery).toBe('Test query')
      expect(context.detectedContext).toBe(ContextType.GENERAL)
    })

    test('should accept context with optional properties', () => {
      const context: AlignmentContext = {
        userQuery: 'Test query',
        conversationHistory: ['Previous message'],
        detectedContext: ContextType.SUPPORT,
        userProfile: {
          demographics: { age: 25, culturalBackground: 'Western' },
          preferences: {
            communicationStyle: 'direct',
            levelOfDetail: 'detailed',
          },
          mentalHealthHistory: {
            conditions: ['anxiety'],
            treatmentHistory: true,
          },
        },
        sessionMetadata: { sessionId: '123', timestamp: Date.now() },
      }

      expect(context.conversationHistory).toHaveLength(1)
      expect(context.userProfile?.demographics?.age).toBe(25)
      expect(context.userProfile?.preferences?.communicationStyle).toBe(
        'direct',
      )
      expect(context.userProfile?.mentalHealthHistory?.conditions).toContain(
        'anxiety',
      )
      expect(context.sessionMetadata?.sessionId).toBe('123')
    })
  })
})
