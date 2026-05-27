// @vitest-environment node

import { beforeEach, describe, expect, it } from 'vitest'

import {
  BlockRegistry,
  defaultBlockRegistry,
  defaultMemoryBlockSchemas,
  validateMemoryBlockContent,
} from './block-registry'

describe('BlockRegistry', () => {
  let registry: BlockRegistry

  beforeEach(() => {
    registry = new BlockRegistry()
  })

  it('registers and lists memory block schemas', () => {
    registry.register({
      label: 'custom_context',
      description: 'Custom context for a focused workflow',
      retentionPolicy: 'short_term',
      mergeStrategy: 'append',
      injectionPoint: 'system',
      scope: 'session',
      charLimit: 120,
    })

    expect(registry.get('custom_context')).toMatchObject({
      label: 'custom_context',
      charLimit: 120,
    })
    expect(registry.list().map((schema) => schema.label)).toEqual([
      'custom_context',
    ])
  })

  it('rejects invalid schema registration', () => {
    expect(() =>
      registry.register({
        label: '',
        description: 'Invalid block',
        retentionPolicy: 'short_term',
        mergeStrategy: 'append',
        injectionPoint: 'system',
        scope: 'session',
        charLimit: 120,
      }),
    ).toThrow('Memory block schema label is required')

    expect(() =>
      registry.register({
        label: 'bad_limit',
        description: 'Invalid block',
        retentionPolicy: 'short_term',
        mergeStrategy: 'append',
        injectionPoint: 'system',
        scope: 'session',
        charLimit: 0,
      }),
    ).toThrow('Memory block schema charLimit must be greater than 0')
  })

  it('rejects duplicate schema labels', () => {
    const schema = {
      label: 'custom_context',
      description: 'Custom context for a focused workflow',
      retentionPolicy: 'short_term',
      mergeStrategy: 'append',
      injectionPoint: 'system',
      scope: 'session',
      charLimit: 120,
    } as const

    registry.register(schema)

    expect(() => registry.register(schema)).toThrow(
      'Memory block schema already registered: custom_context',
    )
  })

  it('validates content against char limit and custom validators', () => {
    registry.register({
      label: 'short_context',
      description: 'Short custom context',
      retentionPolicy: 'short_term',
      mergeStrategy: 'replace',
      injectionPoint: 'system',
      scope: 'session',
      charLimit: 5,
      validator: (content) => content.startsWith('ok'),
    })

    expect(validateMemoryBlockContent(registry, 'short_context', 'ok')).toBeNull()
    expect(
      validateMemoryBlockContent(registry, 'short_context', 'toolong'),
    ).toMatchObject({
      status: 400,
      message: 'Memory block content exceeds short_context limit of 5 characters',
    })
    expect(
      validateMemoryBlockContent(registry, 'short_context', 'bad'),
    ).toMatchObject({
      status: 400,
      message: 'Memory block content failed validation for short_context',
    })
  })

  it('pre-registers default schemas for the current context blocks', () => {
    expect(defaultMemoryBlockSchemas.map((schema) => schema.label)).toEqual([
      'core_directives',
      'guidance',
      'pending_items',
      'project_context',
      'session_patterns',
      'user_preferences',
      'self_improvement',
      'tool_guidelines',
    ])
    expect(defaultBlockRegistry.get('core_directives')).toMatchObject({
      retentionPolicy: 'permanent',
      injectionPoint: 'system',
      scope: 'global',
    })
  })
})
