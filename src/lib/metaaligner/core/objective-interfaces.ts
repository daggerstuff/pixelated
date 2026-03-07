/**
 * Objective definition interfaces and data structures for MetaAligner
 * Provides extensible framework for defining and managing alignment objectives
 */

import type {
  ObjectiveDefinition,
  ObjectiveCriteria,
  AlignmentContext,
} from './objectives'

/**
 * Interface for creating new objective definitions
 */
export interface ObjectiveBuilder {
  setId(id: string): ObjectiveBuilder
  setName(name: string): ObjectiveBuilder
  setDescription(description: string): ObjectiveBuilder
  setWeight(weight: number): ObjectiveBuilder
  addCriterion(criterion: ObjectiveCriteria): ObjectiveBuilder
  setEvaluationFunction(
    fn: (response: string, context: AlignmentContext) => number,
  ): ObjectiveBuilder
  build(): ObjectiveDefinition
  validate(): ValidationResult
}

/**
 * Validation result for objective definitions
 */
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface ValidationWarning {
  field: string
  message: string
  code: string
}

/**
 * Objective registry for managing multiple objective sets
 */
export interface ObjectiveRegistry {
  register(objective: ObjectiveDefinition): void
  unregister(objectiveId: string): boolean
  get(objectiveId: string): ObjectiveDefinition | undefined
  getAll(): ObjectiveDefinition[]
  getByCategory(category: ObjectiveCategory): ObjectiveDefinition[]
  clear(): void
  size(): number
  validate(): ValidationResult
}

/**
 * Categories for organizing objectives
 */
export enum ObjectiveCategory {
  CORE = 'core',
  CLINICAL = 'clinical',
  CULTURAL = 'cultural',
  DEMOGRAPHIC = 'demographic',
  SPECIALIZED = 'specialized',
  EXPERIMENTAL = 'experimental',
  CUSTOM = 'custom',
}

/**
 * Metadata for objective definitions
 */
export interface ObjectiveMetadata {
  category: ObjectiveCategory
  version: string
  author: string
  createdAt: Date
  updatedAt: Date
  tags: string[]
  dependencies: string[]
  compatibleModels: string[]
  minConfidenceThreshold: number
  validationRules: ValidationRule[]
}

/**
 * Validation rules for objectives
 */
export interface ValidationRule {
  name: string
  description: string
  validator: (objective: ObjectiveDefinition) => boolean
  errorMessage: string
}

/**
 * Extended objective definition with metadata
 */
export interface ExtendedObjectiveDefinition extends ObjectiveDefinition {
  metadata: ObjectiveMetadata
}

/**
 * Objective configuration for runtime use
 */
export interface ObjectiveConfiguration {
  objectives: Record<string, number> // objectiveId -> weight
  contextualWeights: Record<string, Record<string, number>> // context -> objectiveId -> weight multiplier
  globalSettings: ObjectiveGlobalSettings
}

export interface ObjectiveGlobalSettings {
  enableDynamicWeighting: boolean
  enableContextualAdjustment: boolean
  minObjectiveScore: number
  maxObjectiveScore: number
  normalizationMethod: NormalizationMethod
  aggregationMethod: AggregationMethod
}

export enum NormalizationMethod {
  NONE = 'none',
  MIN_MAX = 'min_max',
  Z_SCORE = 'z_score',
  SIGMOID = 'sigmoid',
}

export enum AggregationMethod {
  WEIGHTED_AVERAGE = 'weighted_average',
  WEIGHTED_SUM = 'weighted_sum',
  HARMONIC_MEAN = 'harmonic_mean',
  GEOMETRIC_MEAN = 'geometric_mean',
}

/**
 * Objective evaluation result
 */
export interface ObjectiveEvaluationResult {
  objectiveId: string
  score: number
  criteriaScores: Record<string, number>
  confidence: number
  explanation?: string
  metadata: EvaluationMetadata
}

export interface EvaluationMetadata {
  evaluationTime: number // milliseconds
  modelUsed?: string
  contextFactors: string[]
  adjustmentFactors: Record<string, number>
}

/**
 * Combined evaluation result for all objectives
 */
export interface AlignmentEvaluationResult {
  overallScore: number
  objectiveResults: Record<string, ObjectiveEvaluationResult>
  weights: Record<string, number>
  normalizedScores: Record<string, number>
  aggregationMethod: AggregationMethod
  evaluationContext: AlignmentContext
  timestamp: Date
}

/**
 * Configuration schema type for objective templates
 */
export interface ObjectiveConfigSchema {
  [key: string]: {
    type: string
    description?: string
    default?: unknown
    required?: boolean
  }
}

/**
 * Objective template for creating new objectives
 */
export interface ObjectiveTemplate {
  id: string
  name: string
  description: string
  category: ObjectiveCategory
  defaultWeight: number
  criteriaTemplates: CriterionTemplate[]
  evaluationTemplate: string // Template for evaluation function
  configurationSchema: ObjectiveConfigSchema // JSON schema for configuration
}

export interface CriterionTemplate {
  criterion: string
  description: string
  defaultWeight: number
  evaluationHints: string[]
}

/**
 * Implementation of ObjectiveBuilder
 */
export class StandardObjectiveBuilder implements ObjectiveBuilder {
  private objective: Partial<ObjectiveDefinition> = {}
  protected criteria: ObjectiveCriteria[] = []

  setId(id: string): ObjectiveBuilder {
    this.objective.id = id
    return this
  }

  setName(name: string): ObjectiveBuilder {
    this.objective.name = name
    return this
  }

  setDescription(description: string): ObjectiveBuilder {
    this.objective.description = description
    return this
  }

  setWeight(weight: number): ObjectiveBuilder {
    this.objective.weight = weight
    return this
  }

  addCriterion(criterion: ObjectiveCriteria): ObjectiveBuilder {
    this.criteria.push(criterion)
    return this
  }

  setEvaluationFunction(
    fn: (response: string, context: AlignmentContext) => number,
  ): ObjectiveBuilder {
    this.objective.evaluationFunction = fn
    return this
  }

  private validateRequiredFields(errors: ValidationError[]): void {
    const requiredFields = [
      { field: 'id', value: this.objective.id, code: 'MISSING_ID', message: 'Objective ID is required' },
      { field: 'name', value: this.objective.name, code: 'MISSING_NAME', message: 'Objective name is required' },
      { field: 'description', value: this.objective.description, code: 'MISSING_DESCRIPTION', message: 'Objective description is required' },
      { field: 'evaluationFunction', value: this.objective.evaluationFunction, code: 'MISSING_EVALUATION_FUNCTION', message: 'Evaluation function is required' },
    ]

    for (const { field, value, code, message } of requiredFields) {
      if (!value) {
        errors.push({ field, message, code })
      }
    }

    if (this.objective.weight === undefined) {
      errors.push({
        field: 'weight',
        message: 'Objective weight is required',
        code: 'MISSING_WEIGHT',
      })
    }
  }

  private validateWeight(errors: ValidationError[]): void {
    if (
      this.objective.weight !== undefined &&
      (this.objective.weight <= 0 || this.objective.weight > 1)
    ) {
      errors.push({
        field: 'weight',
        message: 'Weight must be between 0 and 1',
        code: 'INVALID_WEIGHT_RANGE',
      })
    }
  }

  private validateCriteria(errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (this.criteria.length === 0) {
      warnings.push({
        field: 'criteria',
        message: 'No criteria defined for objective',
        code: 'NO_CRITERIA',
      })
      return
    }

    const totalCriteriaWeight = this.criteria.reduce(
      (sum, criterion) => sum + criterion.weight,
      0,
    )
    if (Math.abs(totalCriteriaWeight - 1.0) > 0.001) {
      errors.push({
        field: 'criteria',
        message: `Criteria weights sum to ${totalCriteriaWeight}, should sum to 1.0`,
        code: 'INVALID_CRITERIA_WEIGHTS',
      })
    }

    // Validate individual criteria
    for (const criterion of this.criteria) {
      if (!criterion.criterion) {
        errors.push({
          field: 'criteria',
          message: 'Criterion name is required',
          code: 'MISSING_CRITERION_NAME',
        })
      }
      if (!criterion.description) {
        errors.push({
          field: 'criteria',
          message: 'Criterion description is required',
          code: 'MISSING_CRITERION_DESCRIPTION',
        })
      }
      if (criterion.weight <= 0 || criterion.weight > 1) {
        errors.push({
          field: 'criteria',
          message: 'Criterion weight must be between 0 and 1',
          code: 'INVALID_CRITERION_WEIGHT',
        })
      }
    }
  }

  private validateIdFormat(errors: ValidationError[]): void {
    if (
      this.objective.id &&
      !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(this.objective.id)
    ) {
      errors.push({
        field: 'id',
        message:
          'ID must start with a letter and contain only letters, numbers, underscores, and hyphens',
        code: 'INVALID_ID_FORMAT',
      })
    }
  }

  validate(): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    this.validateRequiredFields(errors)
    this.validateWeight(errors)
    this.validateCriteria(errors, warnings)
    this.validateIdFormat(errors)

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  build(): ObjectiveDefinition {
    const validation = this.validate()
    if (!validation.isValid) {
      throw new Error(
        `Invalid objective definition: ${validation.errors.map((e) => e.message).join(', ')}`,
      )
    }

    // Safe to assert non-null here since validation passed
    const { id, name, description, weight, evaluationFunction } = this.objective

    if (
      !id ||
      !name ||
      !description ||
      weight === undefined ||
      !evaluationFunction
    ) {
      throw new Error('Missing required fields after validation')
    }

    return {
      id,
      name,
      description,
      weight,
      criteria: [...this.criteria],
      evaluationFunction,
    }
  }
}

/**
 * Implementation of ObjectiveRegistry
 */
export class StandardObjectiveRegistry implements ObjectiveRegistry {
  private objectives = new Map<string, ObjectiveDefinition>()

  register(objective: ObjectiveDefinition): void {
    // Validate objective before registration
    const builder = new StandardObjectiveBuilder()
      .setId(objective.id)
      .setName(objective.name)
      .setDescription(objective.description)
      .setWeight(objective.weight)
      .setEvaluationFunction(objective.evaluationFunction)

    for (const criterion of objective.criteria) {
      builder.addCriterion(criterion)
    }

    const validation = builder.validate()
    if (!validation.isValid) {
      throw new Error(
        `Cannot register invalid objective: ${validation.errors.map((e) => e.message).join(', ')}`,
      )
    }

    this.objectives.set(objective.id, objective)
  }

  unregister(objectiveId: string): boolean {
    return this.objectives.delete(objectiveId)
  }

  get(objectiveId: string): ObjectiveDefinition | undefined {
    return this.objectives.get(objectiveId)
  }

  getAll(): ObjectiveDefinition[] {
    return Array.from(this.objectives.values())
  }

  getByCategory(_category: ObjectiveCategory): ObjectiveDefinition[] {
    // For basic implementation, return all objectives
    // In extended version with metadata, filter by category
    return this.getAll()
  }

  clear() {
    this.objectives.clear()
  }

  size(): number {
    return this.objectives.size
  }

  validate(): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Check for duplicate IDs (should not happen with Map, but good to verify)
    const ids = new Set<string>()
    for (const objective of this.objectives.values()) {
      if (ids.has(objective.id)) {
        errors.push({
          field: 'registry',
          message: `Duplicate objective ID: ${objective.id}`,
          code: 'DUPLICATE_ID',
        })
      }
      ids.add(objective.id)
    }

    // Validate individual objectives
    for (const objective of this.objectives.values()) {
      const builder = new StandardObjectiveBuilder()
        .setId(objective.id)
        .setName(objective.name)
        .setDescription(objective.description)
        .setWeight(objective.weight)
        .setEvaluationFunction(objective.evaluationFunction)

      for (const criterion of objective.criteria) {
        builder.addCriterion(criterion)
      }

      const validation = builder.validate()
      errors.push(...validation.errors)
      warnings.push(...validation.warnings)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }
}

/**
 * Factory functions for creating common objective structures
 */
export const ObjectiveFactory = {
  createCriterion(
    criterion: string,
    description: string,
    weight: number,
  ): ObjectiveCriteria {
    if (weight <= 0 || weight > 1) {
      throw new Error('Criterion weight must be between 0 and 1')
    }

    return {
      criterion,
      description,
      weight,
    }
  },

  createBasicObjective(
    id: string,
    name: string,
    description: string,
    weight: number,
    criteria: ObjectiveCriteria[],
    evaluationFunction: (response: string, context: AlignmentContext) => number,
  ): ObjectiveDefinition {
    const builder = new StandardObjectiveBuilder()
      .setId(id)
      .setName(name)
      .setDescription(description)
      .setWeight(weight)
      .setEvaluationFunction(evaluationFunction)

    for (const criterion of criteria) {
      builder.addCriterion(criterion)
    }

    return builder.build()
  },

  createFromTemplate(
    template: ObjectiveTemplate,
    _customConfig?: Record<string, unknown>,
  ): ObjectiveDefinition {
    const builder = new StandardObjectiveBuilder()
      .setId(template.id)
      .setName(template.name)
      .setDescription(template.description)
      .setWeight(template.defaultWeight)

    // Add criteria from template
    for (const criterionTemplate of template.criteriaTemplates) {
      builder.addCriterion({
        criterion: criterionTemplate.criterion,
        description: criterionTemplate.description,
        weight: criterionTemplate.defaultWeight,
      })
    }

    // Create a basic evaluation function (would be more sophisticated in real implementation)
    builder.setEvaluationFunction(
      (_response: string, _context: AlignmentContext) => {
        // Placeholder implementation
        return Math.random() // In real implementation, this would use the evaluation template
      },
    )

    return builder.build()
  },
} as const

// Add multiple criteria to builder in one call
declare module './objective-interfaces' {
  interface ObjectiveBuilder {
    addCriterion(...criteria: ObjectiveCriteria[]): ObjectiveBuilder
  }
}

// Extend the StandardObjectiveBuilder to support multiple criteria
StandardObjectiveBuilder.prototype.addCriterion = function (
  ...criteria: ObjectiveCriteria[]
): ObjectiveBuilder {
  if (criteria.length === 1 && criteria[0] !== undefined) {
    this.criteria.push(criteria[0])
  } else {
    for (const criterion of criteria) {
      if (criterion !== undefined) {
        this.criteria.push(criterion)
      }
    }
  }
  return this
}
