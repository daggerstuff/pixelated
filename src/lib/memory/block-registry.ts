export type RetentionPolicy =
  | 'ephemeral'
  | 'short_term'
  | 'long_term'
  | 'permanent'

export type MergeStrategy =
  | 'append'
  | 'replace'
  | 'semantic_merge'
  | 'last_write_wins'

export type InjectionPoint = 'system' | 'developer' | 'user' | 'none'

export type BlockScope = 'global' | 'project' | 'session' | 'user'

export interface MemoryBlockSchema {
  label: string
  description: string
  retentionPolicy: RetentionPolicy
  mergeStrategy: MergeStrategy
  injectionPoint: InjectionPoint
  scope: BlockScope
  charLimit: number
  validator?: (content: string) => boolean
}

export interface MemoryBlockValidationError {
  status: 400
  message: string
}

const retentionPolicies = new Set<RetentionPolicy>([
  'ephemeral',
  'short_term',
  'long_term',
  'permanent',
])
const mergeStrategies = new Set<MergeStrategy>([
  'append',
  'replace',
  'semantic_merge',
  'last_write_wins',
])
const injectionPoints = new Set<InjectionPoint>([
  'system',
  'developer',
  'user',
  'none',
])
const blockScopes = new Set<BlockScope>([
  'global',
  'project',
  'session',
  'user',
])

export class BlockRegistry {
  private static singleton: BlockRegistry | null = null

  private readonly schemas = new Map<string, MemoryBlockSchema>()

  static getInstance(): BlockRegistry {
    BlockRegistry.singleton ??= new BlockRegistry(defaultMemoryBlockSchemas)
    return BlockRegistry.singleton
  }

  constructor(initialSchemas: MemoryBlockSchema[] = []) {
    for (const schema of initialSchemas) {
      this.register(schema)
    }
  }

  register(schema: MemoryBlockSchema): void {
    validateSchema(schema)
    if (this.schemas.has(schema.label)) {
      throw new Error(`Memory block schema already registered: ${schema.label}`)
    }
    this.schemas.set(schema.label, schema)
  }

  get(label: string): MemoryBlockSchema | undefined {
    return this.schemas.get(label)
  }

  list(): MemoryBlockSchema[] {
    return [...this.schemas.values()]
  }
}

export const defaultMemoryBlockSchemas: MemoryBlockSchema[] = [
  {
    label: 'core_directives',
    description: 'Global non-negotiable directives injected into system context.',
    retentionPolicy: 'permanent',
    mergeStrategy: 'replace',
    injectionPoint: 'system',
    scope: 'global',
    charLimit: 12000,
  },
  {
    label: 'guidance',
    description: 'Project and team guidance that shapes routine agent behavior.',
    retentionPolicy: 'long_term',
    mergeStrategy: 'semantic_merge',
    injectionPoint: 'developer',
    scope: 'project',
    charLimit: 12000,
  },
  {
    label: 'pending_items',
    description: 'Active TODOs, unresolved bugs, and in-progress work.',
    retentionPolicy: 'short_term',
    mergeStrategy: 'append',
    injectionPoint: 'developer',
    scope: 'session',
    charLimit: 8000,
  },
  {
    label: 'project_context',
    description: 'High-level architecture, schemas, and sprint context.',
    retentionPolicy: 'long_term',
    mergeStrategy: 'semantic_merge',
    injectionPoint: 'developer',
    scope: 'project',
    charLimit: 16000,
  },
  {
    label: 'session_patterns',
    description: 'Recurring workflows and lessons observed during sessions.',
    retentionPolicy: 'short_term',
    mergeStrategy: 'semantic_merge',
    injectionPoint: 'developer',
    scope: 'session',
    charLimit: 10000,
  },
  {
    label: 'user_preferences',
    description: 'User-specific style, workflow, and collaboration preferences.',
    retentionPolicy: 'permanent',
    mergeStrategy: 'semantic_merge',
    injectionPoint: 'developer',
    scope: 'user',
    charLimit: 12000,
  },
  {
    label: 'self_improvement',
    description: 'Agent self-critique and behavior adjustments.',
    retentionPolicy: 'long_term',
    mergeStrategy: 'semantic_merge',
    injectionPoint: 'developer',
    scope: 'project',
    charLimit: 10000,
  },
  {
    label: 'tool_guidelines',
    description: 'Operational constraints for tools, MCPs, and commands.',
    retentionPolicy: 'long_term',
    mergeStrategy: 'replace',
    injectionPoint: 'developer',
    scope: 'project',
    charLimit: 10000,
  },
]

export const defaultBlockRegistry = BlockRegistry.getInstance()

export function registerSchemaFromMetadata(
  registry: BlockRegistry,
  metadata: Record<string, unknown>,
): void {
  const hasSchemaMetadata =
    Object.hasOwn(metadata, 'blockSchema') || Object.hasOwn(metadata, 'block_schema')
  if (!hasSchemaMetadata) {
    return
  }

  const schemaInput = metadata['blockSchema'] ?? metadata['block_schema']
  const schema = parseMemoryBlockSchema(schemaInput)
  if (!schema) {
    throw new Error('Invalid memory block schema metadata')
  }
  registry.register(schema)
}

export function getMemoryBlockLabel(
  metadata: Record<string, unknown>,
): string | undefined {
  const label = metadata['blockLabel'] ?? metadata['block_label']
  if (typeof label === 'string' && label.trim().length > 0) {
    return label.trim()
  }

  const schema = parseMemoryBlockSchema(
    metadata['blockSchema'] ?? metadata['block_schema'],
  )
  return schema?.label
}

export function validateMemoryBlockContent(
  registry: BlockRegistry,
  label: string,
  content: string,
): MemoryBlockValidationError | null {
  const schema = registry.get(label)
  if (!schema) {
    return {
      status: 400,
      message: `Unknown memory block schema: ${label}`,
    }
  }

  if (content.length > schema.charLimit) {
    return {
      status: 400,
      message: `Memory block content exceeds ${label} limit of ${schema.charLimit} characters`,
    }
  }

  if (schema.validator && !schema.validator(content)) {
    return {
      status: 400,
      message: `Memory block content failed validation for ${label}`,
    }
  }

  return null
}

function validateSchema(schema: MemoryBlockSchema): void {
  if (!schema.label.trim()) {
    throw new Error('Memory block schema label is required')
  }
  if (!schema.description.trim()) {
    throw new Error('Memory block schema description is required')
  }
  if (!retentionPolicies.has(schema.retentionPolicy)) {
    throw new Error(`Invalid retentionPolicy for memory block ${schema.label}`)
  }
  if (!mergeStrategies.has(schema.mergeStrategy)) {
    throw new Error(`Invalid mergeStrategy for memory block ${schema.label}`)
  }
  if (!injectionPoints.has(schema.injectionPoint)) {
    throw new Error(`Invalid injectionPoint for memory block ${schema.label}`)
  }
  if (!blockScopes.has(schema.scope)) {
    throw new Error(`Invalid scope for memory block ${schema.label}`)
  }
  if (!Number.isInteger(schema.charLimit) || schema.charLimit <= 0) {
    throw new Error('Memory block schema charLimit must be greater than 0')
  }
}

function parseMemoryBlockSchema(input: unknown): MemoryBlockSchema | null {
  if (!isRecord(input)) {
    return null
  }

  const label = getString(input, 'label')
  const description = getString(input, 'description')
  const retentionPolicy = getEnumValue(
    input,
    'retentionPolicy',
    'retention_policy',
    retentionPolicies,
  )
  const mergeStrategy = getEnumValue(
    input,
    'mergeStrategy',
    'merge_strategy',
    mergeStrategies,
  )
  const injectionPoint = getEnumValue(
    input,
    'injectionPoint',
    'injection_point',
    injectionPoints,
  )
  const scope = getEnumValue(input, 'scope', 'scope', blockScopes)
  const charLimit = getNumber(input, 'charLimit', 'char_limit')

  if (
    !label ||
    !description ||
    !retentionPolicy ||
    !mergeStrategy ||
    !injectionPoint ||
    !scope ||
    charLimit === undefined
  ) {
    return null
  }

  return {
    label,
    description,
    retentionPolicy,
    mergeStrategy,
    injectionPoint,
    scope,
    charLimit,
  }
}

function getString(input: Record<string, unknown>, key: string): string | null {
  const value = input[key]
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null
}

function getNumber(
  input: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
): number | undefined {
  const value = input[camelKey] ?? input[snakeKey]
  return typeof value === 'number' ? value : undefined
}

function getEnumValue<T extends string>(
  input: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
  validValues: Set<T>,
): T | null {
  const value = input[camelKey] ?? input[snakeKey]
  return typeof value === 'string' && validValues.has(value as T)
    ? (value as T)
    : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
