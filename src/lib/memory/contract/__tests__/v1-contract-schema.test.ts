/**
 * PIX-3901: Schema-level contract tests for v1 Zod schemas.
 *
 * These tests pin the strict-mode behavior of every request/response schema
 * so that extra keys produce parse errors. If any test fails, the public
 * contract has drifted and downstream SDKs / OpenAPI / docs must be
 * regenerated.
 */
import { describe, expect, it } from 'vitest'

import {
  CreateMemoryRequest,
  DeleteMemoryRequest,
  IdentityScope,
  ListMemoriesQuery,
  MemoryApiErrorCodeSchema,
  MemoryApiError,
  MemoryApiRole,
  MemoryApiScope,
  SearchMemoriesQuery,
  SearchMemoriesRequest,
  UpdateMemoryRequest,
} from '../index'

describe('v1 contract schema strict mode (PIX-3901)', () => {
  function expectRejection(schema: unknown, input: unknown) {
    const result = (
      schema as {
        safeParse: (v: unknown) => {
          success: boolean
          error?: { issues: Array<{ message: string }> }
        }
      }
    ).safeParse(input)
    expect(result.success).toBe(false)
  }

  describe('CreateMemoryRequest', () => {
    it('accepts valid input', () => {
      const result = CreateMemoryRequest.safeParse({ content: 'hello' })
      expect(result.success).toBe(true)
    })

    it('rejects unknown fields', () => {
      expectRejection(CreateMemoryRequest, { content: 'hello', rogue: 'nope' })
    })

    it('rejects identity fields', () => {
      expectRejection(CreateMemoryRequest, {
        content: 'hello',
        userId: 'attacker',
      })
      expectRejection(CreateMemoryRequest, {
        content: 'hello',
        workspaceId: 'attacker',
      })
      expectRejection(CreateMemoryRequest, {
        content: 'hello',
        accountId: 'attacker',
      })
    })
  })

  describe('UpdateMemoryRequest', () => {
    it('accepts valid input', () => {
      const result = UpdateMemoryRequest.safeParse({ content: 'updated' })
      expect(result.success).toBe(true)
    })

    it('rejects unknown fields', () => {
      expectRejection(UpdateMemoryRequest, {
        content: 'updated',
        rogue: 'nope',
      })
    })

    it('rejects identity fields', () => {
      expectRejection(UpdateMemoryRequest, {
        content: 'updated',
        userId: 'attacker',
      })
    })
  })

  describe('DeleteMemoryRequest', () => {
    it('accepts empty body', () => {
      const result = DeleteMemoryRequest.safeParse({})
      expect(result.success).toBe(true)
    })

    it('rejects unknown fields', () => {
      expectRejection(DeleteMemoryRequest, { rogue: 'nope' })
    })
  })

  describe('SearchMemoriesRequest', () => {
    it('accepts valid input', () => {
      const result = SearchMemoriesRequest.safeParse({ q: 'hello' })
      expect(result.success).toBe(true)
    })

    it('rejects unknown fields', () => {
      expectRejection(SearchMemoriesRequest, { q: 'hello', rogue: 'nope' })
    })

    it('rejects identity fields', () => {
      expectRejection(SearchMemoriesRequest, { q: 'hello', userId: 'attacker' })
    })
  })

  describe('ListMemoriesQuery', () => {
    it('accepts valid input', () => {
      const result = ListMemoriesQuery.safeParse({ limit: '10', offset: '0' })
      expect(result.success).toBe(true)
    })

    it('rejects unknown fields', () => {
      expectRejection(ListMemoriesQuery, { limit: 10, rogue: 'nope' })
    })
  })

  describe('SearchMemoriesQuery', () => {
    it('accepts valid input', () => {
      const result = SearchMemoriesQuery.safeParse({ q: 'hello' })
      expect(result.success).toBe(true)
    })

    it('rejects unknown fields', () => {
      expectRejection(SearchMemoriesQuery, { q: 'hello', rogue: 'nope' })
    })
  })

  describe('IdentityScope', () => {
    it('accepts valid input', () => {
      const result = IdentityScope.safeParse({
        workspaceId: 'ws-1',
        userId: 'user-1',
        scope: 'product',
        role: 'owner',
      })
      expect(result.success).toBe(true)
    })

    it('rejects unknown fields', () => {
      expectRejection(IdentityScope, {
        workspaceId: 'ws-1',
        userId: 'user-1',
        scope: 'product',
        role: 'owner',
        rogue: 'nope',
      })
    })

    it('rejects invalid scope', () => {
      expectRejection(IdentityScope, {
        workspaceId: 'ws-1',
        userId: 'user-1',
        scope: 'invalid',
        role: 'owner',
      })
    })

    it('rejects invalid role', () => {
      expectRejection(IdentityScope, {
        workspaceId: 'ws-1',
        userId: 'user-1',
        scope: 'product',
        role: 'admin',
      })
    })
  })

  describe('MemoryApiScope', () => {
    it('accepts product', () => {
      expect(MemoryApiScope.parse('product')).toBe('product')
    })

    it('accepts developer', () => {
      expect(MemoryApiScope.parse('developer')).toBe('developer')
    })

    it('rejects invalid value', () => {
      expectRejection(MemoryApiScope, 'invalid')
    })
  })

  describe('MemoryApiRole', () => {
    it('accepts owner', () => {
      expect(MemoryApiRole.parse('owner')).toBe('owner')
    })

    it('accepts clinician', () => {
      expect(MemoryApiRole.parse('clinician')).toBe('clinician')
    })

    it('accepts member', () => {
      expect(MemoryApiRole.parse('member')).toBe('member')
    })

    it('accepts observer', () => {
      expect(MemoryApiRole.parse('observer')).toBe('observer')
    })

    it('rejects invalid value', () => {
      expectRejection(MemoryApiRole, 'admin')
    })
  })

  describe('MemoryApiError', () => {
    it('accepts minimal envelope', () => {
      const result = MemoryApiError.safeParse({
        error: 'not_found',
        message: 'The requested memory was not found.',
      })
      expect(result.success).toBe(true)
    })

    it('accepts full envelope with code, details, requestId', () => {
      const result = MemoryApiError.safeParse({
        error: 'validation_failed',
        message: 'Invalid input',
        code: 'validation_failed',
        details: { fields: ['content'] },
        requestId: 'req-123',
      })
      expect(result.success).toBe(true)
    })

    it('rejects unknown fields', () => {
      expectRejection(MemoryApiError, {
        error: 'not_found',
        message: 'Not found',
        rogue: 'nope',
      })
    })

    it('rejects invalid code value', () => {
      expectRejection(MemoryApiError, {
        error: 'not_found',
        message: 'Not found',
        code: 'totally_invalid_code',
      })
    })
  })

  describe('MemoryApiErrorCodeSchema', () => {
    it('accepts all defined error codes', () => {
      const codes = [
        'bad_request',
        'validation_failed',
        'unauthorized',
        'forbidden',
        'not_found',
        'conflict',
        'payload_too_large',
        'rate_limited',
        'gate_blocked',
        'internal_error',
        'upstream_unavailable',
        'upstream_timeout',
      ]
      for (const code of codes) {
        expect(MemoryApiErrorCodeSchema.parse(code)).toBe(code)
      }
    })

    it('rejects invalid code', () => {
      expectRejection(MemoryApiErrorCodeSchema, 'nonexistent_error')
    })
  })
})
