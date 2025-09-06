import { describe, test, beforeEach, expect } from 'vitest'
import type {
  ObjectiveBuilder,
  ObjectiveRegistry,
  ValidationResult,
  ObjectiveTemplate,
} from './objective-interfaces'
import {
  ObjectiveCategory,
  StandardObjectiveBuilder,
  StandardObjectiveRegistry,
  ObjectiveFactory,
  NormalizationMethod,
  AggregationMethod,
} from './objective-interfaces'
import type { ObjectiveDefinition } from './objectives'

// Mock evaluation function for testing
const createMockEvaluationFunction =
  (returnValue = 0.8) =>
  () =>
    returnValue

describe('Objective Interfaces', () => {
  describe('StandardObjectiveBuilder', () => {
    let builder: ObjectiveBuilder

    beforeEach(() => {
      builder = new StandardObjectiveBuilder()
    })

    test('should build valid objective with all required fields', () => {
      const mockEvaluationFunction = createMockEvaluationFunction(0.8)

      const objective = builder
        .setId('test-objective')
        .setName('Test Objective')
        .setDescription('A test objective for validation')
        .setWeight(0.3)
        .addCriterion({
          criterion: 'test-criterion',
          description: 'Test criterion description',
          weight: 1.0,
        })
        .setEvaluationFunction(mockEvaluationFunction)
        .build()

      expect(objective.id).toBe('test-objective')
      expect(objective.name).toBe('Test Objective')
      expect(objective.description).toBe('A test objective for validation')
      expect(objective.weight).toBe(0.3)
      expect(objective.criteria).toHaveLength(1)
      expect(objective.criteria[0].criterion).toBe('test-criterion')
      expect(objective.evaluationFunction).toBe(mockEvaluationFunction)
    })

    test('should validate successfully with valid data', () => {
      const mockEvaluationFunction = createMockEvaluationFunction(0.8)

      builder
        .setId('test-objective')
        .setName('Test Objective')
        .setDescription('A test objective')
        .setWeight(0.5)
        .addCriterion({
          criterion: 'criterion1',
          description: 'First criterion',
          weight: 0.6,
        })
        .addCriterion({
          criterion: 'criterion2',
          description: 'Second criterion',
          weight: 0.4,
        })
        .setEvaluationFunction(mockEvaluationFunction)

      const validation = builder.validate()
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    test('should fail validation when required fields are missing', () => {
      const validation = builder.validate()

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toHaveLength(5) // id, name, description, weight, evaluationFunction

      const errorCodes = validation.errors.map((e) => e.code)
      expect(errorCodes).toContain('MISSING_ID')
      expect(errorCodes).toContain('MISSING_NAME')
      expect(errorCodes).toContain('MISSING_DESCRIPTION')
      expect(errorCodes).toContain('MISSING_WEIGHT')
      expect(errorCodes).toContain('MISSING_EVALUATION_FUNCTION')
    })

    test('should fail validation with invalid weight range', () => {
      const mockEvaluationFunction = createMockEvaluationFunction(0.8)

      builder
        .setId('test-objective')
        .setName('Test Objective')
        .setDescription('A test objective')
        .setWeight(1.5) // Invalid weight > 1
        .setEvaluationFunction(mockEvaluationFunction)

      const validation = builder.validate()
      expect(validation.isValid).toBe(false)
      expect(
        validation.errors.some((e) => e.code === 'INVALID_WEIGHT_RANGE'),
      ).toBe(true)
    })

    test('should fail validation when criteria weights do not sum to 1', () => {
      const mockEvaluationFunction = createMockEvaluationFunction(0.8)

      builder
        .setId('test-objective')
        .setName('Test Objective')
        .setDescription('A test objective')
        .setWeight(0.5)
        .addCriterion({
          criterion: 'criterion1',
          description: 'First criterion',
          weight: 0.3,
        })
        .addCriterion({
          criterion: 'criterion2',
          description: 'Second criterion',
          weight: 0.4,
        }) // Total weight = 0.7, not 1.0
        .setEvaluationFunction(mockEvaluationFunction)

      const validation = builder.validate()
      expect(validation.isValid).toBe(false)
      expect(
        validation.errors.some((e) => e.code === 'INVALID_CRITERIA_WEIGHTS'),
      ).toBe(true)
    })

    test('should show warning when no criteria are defined', () => {
      const mockEvaluationFunction = createMockEvaluationFunction(0.8)

      builder
        .setId('test-objective')
        .setName('Test Objective')
        .setDescription('A test objective')
        .setWeight(0.5)
        .setEvaluationFunction(mockEvaluationFunction)

      const validation = builder.validate()
      expect(validation.warnings.some((w) => w.code === 'NO_CRITERIA')).toBe(
        true,
      )
    })

    test('should throw error when building invalid objective', () => {
      expect(() => {
        builder.setId('test').build() // Missing required fields
      }).toThrow('Invalid objective definition')
    })

    test('should support method chaining', () => {
      const mockEvaluationFunction = createMockEvaluationFunction(0.8)

      const result = builder
        .setId('test')
        .setName('Test')
        .setDescription('Test')
        .setWeight(0.5)
        .setEvaluationFunction(mockEvaluationFunction)

      expect(result).toBe(builder) // Should return the same instance for chaining
    })
  })

  describe('StandardObjectiveRegistry', () => {
    let registry: ObjectiveRegistry
    let mockObjective: ObjectiveDefinition

    beforeEach(() => {
      registry = new StandardObjectiveRegistry()
      mockObjective = {
        id: 'test-objective',
        name: 'Test Objective',
        description: 'A test objective',
        weight: 0.5,
        criteria: [
          {
            criterion: 'test-criterion',
            description: 'Test criterion',
            weight: 1.0,
          },
        ],
        evaluationFunction: createMockEvaluationFunction(0.8),
      }
    })

    test('should register and retrieve objectives', () => {
      registry.register(mockObjective)

      const retrieved = registry.get('test-objective')
      expect(retrieved).toEqual(mockObjective)
      expect(registry.size()).toBe(1)
    })

    test('should return undefined for non-existent objective', () => {
      const retrieved = registry.get('non-existent')
      expect(retrieved).toBeUndefined()
    })

    test('should unregister objectives', () => {
      registry.register(mockObjective)
      expect(registry.size()).toBe(1)

      const unregistered = registry.unregister('test-objective')
      expect(unregistered).toBe(true)
      expect(registry.size()).toBe(0)
      expect(registry.get('test-objective')).toBeUndefined()
    })

    test('should return false when unregistering non-existent objective', () => {
      const unregistered = registry.unregister('non-existent')
      expect(unregistered).toBe(false)
    })

    test('should return all registered objectives', () => {
      const mockObjective2: ObjectiveDefinition = {
        ...mockObjective,
        id: 'test-objective-2',
        name: 'Test Objective 2',
      }

      registry.register(mockObjective)
      registry.register(mockObjective2)

      const allObjectives = registry.getAll()
      expect(allObjectives).toHaveLength(2)
      expect(allObjectives).toContainEqual(mockObjective)
      expect(allObjectives).toContainEqual(mockObjective2)
    })

    test('should clear all objectives', () => {
      registry.register(mockObjective)
      expect(registry.size()).toBe(1)

      registry.clear()
      expect(registry.size()).toBe(0)
      expect(registry.getAll()).toHaveLength(0)
    })

    test('should validate registry contents', () => {
      registry.register(mockObjective)

      const validation = registry.validate()
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    test('should throw error when registering invalid objective', () => {
      const invalidObjective = {
        ...mockObjective,
        weight: 1.5, // Invalid weight
      }

      expect(() => {
        registry.register(invalidObjective)
      }).toThrow('Cannot register invalid objective')
    })

    test('should get objectives by category', () => {
      registry.register(mockObjective)

      const coreObjectives = registry.getByCategory(ObjectiveCategory.CORE)
      expect(Array.isArray(coreObjectives)).toBe(true)
      // In basic implementation, returns all objectives
      expect(coreObjectives).toContain(mockObjective)
    })
  })

  describe('ObjectiveFactory', () => {
    test('should create criterion with valid parameters', () => {
      const criterion = ObjectiveFactory.createCriterion(
        'test-criterion',
        'Test criterion description',
        0.5,
      )

      expect(criterion.criterion).toBe('test-criterion')
      expect(criterion.description).toBe('Test criterion description')
      expect(criterion.weight).toBe(0.5)
    })

    test('should throw error for invalid criterion weight', () => {
      expect(() => {
        ObjectiveFactory.createCriterion('test', 'test', 0) // weight = 0
      }).toThrow('Criterion weight must be between 0 and 1')

      expect(() => {
        ObjectiveFactory.createCriterion('test', 'test', 1.5) // weight > 1
      }).toThrow('Criterion weight must be between 0 and 1')
    })

    test('should create basic objective', () => {
      const mockEvaluationFunction = createMockEvaluationFunction(0.8)
      const criteria = [
        ObjectiveFactory.createCriterion('criterion1', 'First criterion', 0.6),
        ObjectiveFactory.createCriterion('criterion2', 'Second criterion', 0.4),
      ]

      const objective = ObjectiveFactory.createBasicObjective(
        'test-objective',
        'Test Objective',
        'A test objective',
        0.5,
        criteria,
        mockEvaluationFunction,
      )

      expect(objective.id).toBe('test-objective')
      expect(objective.name).toBe('Test Objective')
      expect(objective.description).toBe('A test objective')
      expect(objective.weight).toBe(0.5)
      expect(objective.criteria).toEqual(criteria)
      expect(objective.evaluationFunction).toBe(mockEvaluationFunction)
    })

    test('should create objective from template', () => {
      const template: ObjectiveTemplate = {
        id: 'template-objective',
        name: 'Template Objective',
        description: 'An objective created from template',
        category: ObjectiveCategory.CORE,
        defaultWeight: 0.3,
        criteriaTemplates: [
          {
            criterion: 'template-criterion',
            description: 'Template criterion',
            defaultWeight: 1.0,
            evaluationHints: ['hint1', 'hint2'],
          },
        ],
        evaluationTemplate: 'basic evaluation',
        configurationSchema: {},
      }

      const objective = ObjectiveFactory.createFromTemplate(template)

      expect(objective.id).toBe('template-objective')
      expect(objective.name).toBe('Template Objective')
      expect(objective.description).toBe('An objective created from template')
      expect(objective.weight).toBe(0.3)
      expect(objective.criteria).toHaveLength(1)
      expect(objective.criteria[0].criterion).toBe('template-criterion')
      expect(typeof objective.evaluationFunction).toBe('function')
    })
  })

  describe('Enums', () => {
    test('ObjectiveCategory should have expected values', () => {
      expect(ObjectiveCategory.CORE).toBe('core')
      expect(ObjectiveCategory.CLINICAL).toBe('clinical')
      expect(ObjectiveCategory.CULTURAL).toBe('cultural')
      expect(ObjectiveCategory.DEMOGRAPHIC).toBe('demographic')
      expect(ObjectiveCategory.SPECIALIZED).toBe('specialized')
      expect(ObjectiveCategory.EXPERIMENTAL).toBe('experimental')
      expect(ObjectiveCategory.CUSTOM).toBe('custom')
    })

    test('NormalizationMethod should have expected values', () => {
      expect(NormalizationMethod.NONE).toBe('none')
      expect(NormalizationMethod.MIN_MAX).toBe('min_max')
      expect(NormalizationMethod.Z_SCORE).toBe('z_score')
      expect(NormalizationMethod.SIGMOID).toBe('sigmoid')
    })

    test('AggregationMethod should have expected values', () => {
      expect(AggregationMethod.WEIGHTED_AVERAGE).toBe('weighted_average')
      expect(AggregationMethod.WEIGHTED_SUM).toBe('weighted_sum')
      expect(AggregationMethod.HARMONIC_MEAN).toBe('harmonic_mean')
      expect(AggregationMethod.GEOMETRIC_MEAN).toBe('geometric_mean')
    })
  })

  describe('Interface Validation', () => {
    test('ValidationResult should contain expected properties', () => {
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
      }

      expect(result.isValid).toBe(true)
      expect(Array.isArray(result.errors)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
    })

    test('ValidationError should contain expected properties', () => {
      const builder = new StandardObjectiveBuilder()
      const validation = builder.validate()

      for (const error of validation.errors) {
        expect(error).toHaveProperty('field')
        expect(error).toHaveProperty('message')
        expect(error).toHaveProperty('code')
        expect(typeof error.field).toBe('string')
        expect(typeof String(error)).toBe('string')
        expect(typeof error.code).toBe('string')
      }
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty registry operations', () => {
      const registry = new StandardObjectiveRegistry()

      expect(registry.size()).toBe(0)
      expect(registry.getAll()).toHaveLength(0)
      expect(registry.get('anything')).toBeUndefined()
      expect(registry.unregister('anything')).toBe(false)

      const validation = registry.validate()
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    test('should handle multiple criteria addition', () => {
      const builder = new StandardObjectiveBuilder()
      const criterion1 = ObjectiveFactory.createCriterion(
        'c1',
        'Criterion 1',
        0.3,
      )
      const criterion2 = ObjectiveFactory.createCriterion(
        'c2',
        'Criterion 2',
        0.7,
      )

      builder.addCriterion(criterion1)
      builder.addCriterion(criterion2)

      // Build a valid objective to test criteria were added
      const mockEvaluationFunction = createMockEvaluationFunction(0.8)
      const objective = builder
        .setId('test')
        .setName('Test')
        .setDescription('Test')
        .setWeight(0.5)
        .setEvaluationFunction(mockEvaluationFunction)
        .build()

      expect(objective.criteria).toHaveLength(2)
      expect(objective.criteria[0]).toEqual(criterion1)
      expect(objective.criteria[1]).toEqual(criterion2)
    })
  })
})
