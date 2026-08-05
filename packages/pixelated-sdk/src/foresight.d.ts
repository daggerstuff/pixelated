/**
 * @pixelated-empathy/sdk — ForesightClient
 *
 * First-class TypeScript SDK for Foresight memory operations with
 * full Zod runtime validation.
 *
 * Usage:
 *   const foresight = new ForesightClient({ baseUrl: '/api/v1/memory' })
 *   const memory = await foresight.storeMemory({ content: '...' })
 */
import type { UnifiedMemory } from '@pixelated/memory-schema'
import { z } from 'zod'
export declare const MemoryScope: z.ZodEnum<{
  session: 'session'
  arc: 'arc'
  trait: 'trait'
  fact: 'fact'
}>
export type MemoryScope = z.infer<typeof MemoryScope>
export declare const RetentionPolicy: z.ZodEnum<{
  ephemeral: 'ephemeral'
  short_term: 'short_term'
  long_term: 'long_term'
  permanent: 'permanent'
}>
export type RetentionPolicy = z.infer<typeof RetentionPolicy>
export declare const ForesightMemory: z.ZodObject<
  {
    id: z.ZodString
    content: z.ZodString
    category: z.ZodString
    tags: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>
    scope: z.ZodDefault<
      z.ZodOptional<
        z.ZodEnum<{
          session: 'session'
          arc: 'arc'
          trait: 'trait'
          fact: 'fact'
        }>
      >
    >
    retention: z.ZodDefault<
      z.ZodOptional<
        z.ZodEnum<{
          ephemeral: 'ephemeral'
          short_term: 'short_term'
          long_term: 'long_term'
          permanent: 'permanent'
        }>
      >
    >
    importance: z.ZodDefault<z.ZodOptional<z.ZodNumber>>
    emotionalContext: z.ZodOptional<
      z.ZodObject<
        {
          valence: z.ZodOptional<z.ZodNumber>
          arousal: z.ZodOptional<z.ZodNumber>
          dominance: z.ZodOptional<z.ZodNumber>
          primaryEmotion: z.ZodOptional<z.ZodString>
          intensity: z.ZodOptional<z.ZodNumber>
        },
        z.core.$strip
      >
    >
    createdAt: z.ZodString
    updatedAt: z.ZodNullable<z.ZodString>
  },
  z.core.$strip
>
export type ForesightMemory = z.infer<typeof ForesightMemory>
export declare const StoreMemoryInput: z.ZodObject<
  {
    content: z.ZodString
    category: z.ZodOptional<z.ZodString>
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>
    scope: z.ZodOptional<
      z.ZodEnum<{
        session: 'session'
        arc: 'arc'
        trait: 'trait'
        fact: 'fact'
      }>
    >
    retention: z.ZodOptional<
      z.ZodEnum<{
        ephemeral: 'ephemeral'
        short_term: 'short_term'
        long_term: 'long_term'
        permanent: 'permanent'
      }>
    >
    importance: z.ZodOptional<z.ZodNumber>
    emotionalContext: z.ZodOptional<
      z.ZodObject<
        {
          valence: z.ZodOptional<z.ZodNumber>
          arousal: z.ZodOptional<z.ZodNumber>
          dominance: z.ZodOptional<z.ZodNumber>
          primaryEmotion: z.ZodOptional<z.ZodString>
          intensity: z.ZodOptional<z.ZodNumber>
        },
        z.core.$strip
      >
    >
  },
  z.core.$strict
>
export type StoreMemoryInput = z.infer<typeof StoreMemoryInput>
export declare const StoreMemoryOutput: z.ZodObject<
  {
    id: z.ZodString
    content: z.ZodString
    category: z.ZodString
    tags: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>
    scope: z.ZodEnum<{
      session: 'session'
      arc: 'arc'
      trait: 'trait'
      fact: 'fact'
    }>
    retention: z.ZodEnum<{
      ephemeral: 'ephemeral'
      short_term: 'short_term'
      long_term: 'long_term'
      permanent: 'permanent'
    }>
    importance: z.ZodNumber
    createdAt: z.ZodString
  },
  z.core.$strict
>
export type StoreMemoryOutput = z.infer<typeof StoreMemoryOutput>
export declare const GetMemoryInput: z.ZodObject<
  {
    memoryId: z.ZodString
  },
  z.core.$strict
>
export type GetMemoryInput = z.infer<typeof GetMemoryInput>
export declare const QueryMemoriesInput: z.ZodObject<
  {
    query: z.ZodString
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>
    offset: z.ZodDefault<z.ZodOptional<z.ZodNumber>>
    minImportance: z.ZodOptional<z.ZodNumber>
    category: z.ZodOptional<z.ZodString>
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>
    scope: z.ZodOptional<
      z.ZodEnum<{
        session: 'session'
        arc: 'arc'
        trait: 'trait'
        fact: 'fact'
      }>
    >
  },
  z.core.$strict
>
export type QueryMemoriesInput = z.infer<typeof QueryMemoriesInput>
export declare const ListMemoriesInput: z.ZodObject<
  {
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>
    offset: z.ZodDefault<z.ZodOptional<z.ZodNumber>>
    category: z.ZodOptional<z.ZodString>
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>
    scope: z.ZodOptional<
      z.ZodEnum<{
        session: 'session'
        arc: 'arc'
        trait: 'trait'
        fact: 'fact'
      }>
    >
    retention: z.ZodOptional<
      z.ZodEnum<{
        ephemeral: 'ephemeral'
        short_term: 'short_term'
        long_term: 'long_term'
        permanent: 'permanent'
      }>
    >
  },
  z.core.$strict
>
export type ListMemoriesInput = z.infer<typeof ListMemoriesInput>
export declare const ListMemoriesOutput: z.ZodObject<
  {
    data: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString
          content: z.ZodString
          category: z.ZodString
          tags: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>
          scope: z.ZodDefault<
            z.ZodOptional<
              z.ZodEnum<{
                session: 'session'
                arc: 'arc'
                trait: 'trait'
                fact: 'fact'
              }>
            >
          >
          retention: z.ZodDefault<
            z.ZodOptional<
              z.ZodEnum<{
                ephemeral: 'ephemeral'
                short_term: 'short_term'
                long_term: 'long_term'
                permanent: 'permanent'
              }>
            >
          >
          importance: z.ZodDefault<z.ZodOptional<z.ZodNumber>>
          emotionalContext: z.ZodOptional<
            z.ZodObject<
              {
                valence: z.ZodOptional<z.ZodNumber>
                arousal: z.ZodOptional<z.ZodNumber>
                dominance: z.ZodOptional<z.ZodNumber>
                primaryEmotion: z.ZodOptional<z.ZodString>
                intensity: z.ZodOptional<z.ZodNumber>
              },
              z.core.$strip
            >
          >
          createdAt: z.ZodString
          updatedAt: z.ZodNullable<z.ZodString>
        },
        z.core.$strip
      >
    >
    pagination: z.ZodObject<
      {
        limit: z.ZodNumber
        offset: z.ZodNumber
        total: z.ZodNumber
      },
      z.core.$strict
    >
  },
  z.core.$strict
>
export type ListMemoriesOutput = z.infer<typeof ListMemoriesOutput>
export declare const UpdateMemoryInput: z.ZodObject<
  {
    memoryId: z.ZodString
    content: z.ZodOptional<z.ZodString>
    category: z.ZodOptional<z.ZodString>
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>
    importance: z.ZodOptional<z.ZodNumber>
    scope: z.ZodOptional<
      z.ZodEnum<{
        session: 'session'
        arc: 'arc'
        trait: 'trait'
        fact: 'fact'
      }>
    >
    retention: z.ZodOptional<
      z.ZodEnum<{
        ephemeral: 'ephemeral'
        short_term: 'short_term'
        long_term: 'long_term'
        permanent: 'permanent'
      }>
    >
  },
  z.core.$strict
>
export type UpdateMemoryInput = z.infer<typeof UpdateMemoryInput>
export declare const DeleteMemoryInput: z.ZodObject<
  {
    memoryId: z.ZodString
  },
  z.core.$strict
>
export type DeleteMemoryInput = z.infer<typeof DeleteMemoryInput>
export declare const DeleteMemoryOutput: z.ZodObject<
  {
    id: z.ZodString
  },
  z.core.$strict
>
export type DeleteMemoryOutput = z.infer<typeof DeleteMemoryOutput>
export interface ForesightClientConfig {
  baseUrl?: string
  fetchFn?: typeof fetch
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>
  timeout?: number
  maxRetries?: number
  retryDelay?: number
}
/**
 * Typed error thrown on non-2xx responses from the Foresight API.
 */
export declare class ForesightClientError extends Error {
  readonly statusCode: number
  readonly body?: unknown
  constructor(message: string, statusCode: number, body?: unknown)
}
/**
 * First-class TypeScript SDK client for Foresight memory operations.
 *
 * All input objects are validated via Zod before being sent.
 * All output objects are parsed through Zod before being returned.
 *
 * @example
 * ```ts
 * const foresight = new ForesightClient({
 *   baseUrl: '/api/v1/memory',
 *   getHeaders: () => ({ Authorization: `Bearer ${token}` }),
 * })
 * const memory = await foresight.storeMemory({ content: '...' })
 * ```
 */
export declare class ForesightClient {
  readonly baseUrl: string
  private readonly fetchFn
  private readonly getHeaders?
  private readonly timeout
  private readonly maxRetries
  private readonly retryDelay
  constructor(config?: ForesightClientConfig)
  private request
  /**
   * Store a new memory.
   *
   * POST /api/v1/memory
   */
  storeMemory(
    input: z.infer<typeof StoreMemoryInput>,
  ): Promise<z.infer<typeof StoreMemoryOutput>>
  /**
   * Retrieve a single memory by ID.
   *
   * GET /api/v1/memory/:memoryId
   */
  getMemory(
    input: z.infer<typeof GetMemoryInput>,
  ): Promise<z.infer<typeof ForesightMemory>>
  /**
   * Query memories using keyword + semantic (hybrid) retrieval.
   *
   * GET /api/v1/memory/search?q=...
   */
  queryMemories(
    input: z.infer<typeof QueryMemoriesInput>,
  ): Promise<z.infer<typeof ListMemoriesOutput>>
  /**
   * List memories with optional filtering.
   *
   * GET /api/v1/memory?limit=...&offset=...
   */
  listMemories(
    input?: z.infer<typeof ListMemoriesInput>,
  ): Promise<z.infer<typeof ListMemoriesOutput>>
  /**
   * Update a memory record.
   *
   * PATCH /api/v1/memory/:memoryId
   */
  updateMemory(
    input: z.infer<typeof UpdateMemoryInput>,
  ): Promise<z.infer<typeof ForesightMemory>>
  /**
   * Delete a memory record.
   *
   * DELETE /api/v1/memory/:memoryId
   */
  deleteMemory(
    input: z.infer<typeof DeleteMemoryInput>,
  ): Promise<z.infer<typeof DeleteMemoryOutput>>
}
export type { UnifiedMemory }
