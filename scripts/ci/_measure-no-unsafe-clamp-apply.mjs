#!/usr/bin/env node
// scripts/ci/_measure-no-unsafe-clamp-apply.mjs
//
// Apply companion for `scripts/ci/measure-no-unsafe-clamp.sh`. Performs
// Phase 1 typed-I/O-boundary surface edits across the 4 quick-win files.
//
// Each entry below MUST be:
//   - Unique in the file (the patcher fails if an anchor appears more than once).
//   - Exact byte-for-byte with the in-tree source (overseer doesn't normalise
//     whitespace and the patcher doesn't either, so a single trailing space
//     mismatch will fail loud).
//
// After applying, run `pnpm typecheck` to verify the modified files compile.

import { readFileSync, writeFileSync } from 'node:fs'

/**
 * @typedef {{ file: string, find: string, replace: string }} Edit
 * @type {Edit[]}
 */
const edits = [
  // ========================================================================
  // 1. packages/pixelated-sdk/src/index.ts
  // ========================================================================

  // 1a. Add zod import at the top.
  {
    file: 'packages/pixelated-sdk/src/index.ts',
    find: 'import {\n  ForesightClient,',
    replace: "import { z } from 'zod'\n\nimport {\n  ForesightClient,",
  },

  // 1b. Add UserProfileSchema after UserProfile interface.
  {
    file: 'packages/pixelated-sdk/src/index.ts',
    find: `export interface UserProfile {
  id: string
  fullName?: string
  email: string
  role: string
  avatarUrl?: string
  createdAt: string
  lastLogin?: string
}`,
    replace: `export interface UserProfile {
  id: string
  fullName?: string
  email: string
  role: string
  avatarUrl?: string
  createdAt: string
  lastLogin?: string
}

export const UserProfileSchema: z.ZodType<UserProfile> = z.object({
  id: z.string(),
  fullName: z.string().optional(),
  email: z.string(),
  role: z.string(),
  avatarUrl: z.string().optional(),
  createdAt: z.string(),
  lastLogin: z.string().optional(),
})`,
  },

  // 1c. Add BiasAnalysisResultSchema after BiasAnalysisResult interface.
  {
    file: 'packages/pixelated-sdk/src/index.ts',
    find: `export interface BiasAnalysisResult {
  id: string
  biases: Array<{
    type: string
    confidence: number
    evidence: string
    suggestion: string
  }>
  overallScore: number
  recommendations: string[]
}`,
    replace: `export interface BiasAnalysisResult {
  id: string
  biases: Array<{
    type: string
    confidence: number
    evidence: string
    suggestion: string
  }>
  overallScore: number
  recommendations: string[]
}

export const BiasAnalysisResultSchema: z.ZodType<BiasAnalysisResult> = z.object({
  id: z.string(),
  biases: z.array(
    z.object({
      type: z.string(),
      confidence: z.number(),
      evidence: z.string(),
      suggestion: z.string(),
    }),
  ),
  overallScore: z.number(),
  recommendations: z.array(z.string()),
})`,
  },

  // 1d. Add SearchResultSchema after SearchResult interface.
  {
    file: 'packages/pixelated-sdk/src/index.ts',
    find: `export interface SearchResult {
  id: string
  title: string
  excerpt: string
  url: string
  type: string
  score: number
}`,
    replace: `export interface SearchResult {
  id: string
  title: string
  excerpt: string
  url: string
  type: string
  score: number
}

export const SearchResultSchema: z.ZodType<SearchResult> = z.object({
  id: z.string(),
  title: z.string(),
  excerpt: z.string(),
  url: z.string(),
  type: z.string(),
  score: z.number(),
})`,
  },

  // 1e. parseResponse signature — make schema REQUIRED + return schema.parse.
  {
    file: 'packages/pixelated-sdk/src/index.ts',
    find: `  private async parseResponse(response: Response): Promise<any> {
    const text = await response.text()
    if (!text) return {}
    try {
      return JSON.parse(text)
    } catch {
      return { raw: text }
    }
  }`,
    replace: `  private async parseResponse<T>(
    response: Response,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const text = await response.text()
    try {
      const parsed: unknown = text ? JSON.parse(text) : {}
      return schema.parse(parsed)
    } catch (err) {
      if (err instanceof z.ZodError) {
        const summary = err.issues
          .map((i) => (i.path.length ? i.path.join('.') + ': ' : '') + i.message)
          .join('; ')
        throw new Error(\`Response schema mismatch: \${summary}\`)
      }
      throw err
    }
  }`,
  },

  // 1f. response<T>: add schema parameter.
  {
    file: 'packages/pixelated-sdk/src/index.ts',
    find: `  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0,
  ): Promise<T> {`,
    replace: `  private async request<T>(
    endpoint: string,
    schema: z.ZodType<T>,
    options: RequestInit = {},
    retryCount = 0,
  ): Promise<T> {`,
  },

  // 1g. error path in request: best-effort decode (we no longer have schema here).
  {
    file: 'packages/pixelated-sdk/src/index.ts',
    find: `      if (!response.ok) {
        const errorData = await this.parseResponse(response).catch(() => ({}))
        const error: ApiError = {
          name: 'ApiError',
          message: errorData.error ?? \`API Error: \${response.statusText}\`,
          status: response.status,
          code: errorData.code ?? 'UNKNOWN',
          details: errorData.details,
        }
        throw error
      }`,
    replace: `      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        let errorData: { error?: string; code?: string; details?: unknown } = {}
        try {
          errorData = errorText ? JSON.parse(errorText) : {}
        } catch {
          /* leave errorData as {} */
        }
        const error: ApiError = {
          name: 'ApiError',
          message: errorData.error ?? \`API Error: \${response.statusText}\`,
          status: response.status,
          code: errorData.code ?? 'UNKNOWN',
          details: errorData.details,
        }
        throw error
      }`,
  },

  // 1h. success path in request: forward schema to parseResponse.
  {
    file: 'packages/pixelated-sdk/src/index.ts',
    find: `      return await this.parseResponse(response)`,
    replace: '      return await this.parseResponse(response, schema)',
  },

  // 1i. getProfile: pass UserProfileSchema.
  {
    file: 'packages/pixelated-sdk/src/index.ts',
    find: `      getProfile: async (): Promise<UserProfile> => {
        const response = await this.request<{ profile: UserProfile }>(
          '/profile',
        )
        return response.profile
      },`,
    replace: `      getProfile: async (): Promise<UserProfile> => {
        const response = await this.request<{ profile: UserProfile }>(
          '/profile',
          z.object({ profile: UserProfileSchema }),
        )
        return response.profile
      },`,
  },

  // 1j. updateProfile: pass UserProfileSchema.
  {
    file: 'packages/pixelated-sdk/src/index.ts',
    find: `      updateProfile: async (
        updates: Partial<UserProfile>,
      ): Promise<UserProfile> => {
        const response = await this.request<{ profile: UserProfile }>(
          '/profile',
          {
            method: 'PUT',
            body: JSON.stringify(updates),
          },
        )
        return response.profile
      },`,
    replace: `      updateProfile: async (
        updates: Partial<UserProfile>,
      ): Promise<UserProfile> => {
        const response = await this.request<{ profile: UserProfile }>(
          '/profile',
          z.object({ profile: UserProfileSchema }),
          {
            method: 'PUT',
            body: JSON.stringify(updates),
          },
        )
        return response.profile
      },`,
  },

  // 1k. analyze (BiasAnalysisResult): pass BiasAnalysisResultSchema.
  {
    file: 'packages/pixelated-sdk/src/index.ts',
    find: `      analyze: async (
        params: BiasAnalysisParams,
      ): Promise<BiasAnalysisResult> => {
        return this.request<BiasAnalysisResult>('/bias-analysis/analyze', {
          method: 'POST',
          body: JSON.stringify(params),
        })
      },`,
    replace: `      analyze: async (
        params: BiasAnalysisParams,
      ): Promise<BiasAnalysisResult> => {
        return this.request<BiasAnalysisResult>(
          '/bias-analysis/analyze',
          BiasAnalysisResultSchema,
          {
            method: 'POST',
            body: JSON.stringify(params),
          },
        )
      },`,
  },

  // 1l. search.query: pass { results: SearchResultSchema[] } schema.
  {
    file: 'packages/pixelated-sdk/src/index.ts',
    find: `      query: async (
        query: string,
        filters?: { type?: string; limit?: number },
      ): Promise<SearchResult[]> => {
        const params = new URLSearchParams({ q: query })
        if (filters?.type) params.append('type', filters.type)
        if (filters?.limit) params.append('limit', filters.limit.toString())

        const response = await this.request<{ results: SearchResult[] }>(
          \`/search?\${params}\`,
        )
        return response.results
      },`,
    replace: `      query: async (
        query: string,
        filters?: { type?: string; limit?: number },
      ): Promise<SearchResult[]> => {
        const params = new URLSearchParams({ q: query })
        if (filters?.type) params.append('type', filters.type)
        if (filters?.limit) params.append('limit', filters.limit.toString())

        const response = await this.request<{ results: SearchResult[] }>(
          \`/search?\${params}\`,
          z.object({ results: z.array(SearchResultSchema) }),
        )
        return response.results
      },`,
  },

  // ========================================================================
  // 2. packages/pixelated-sdk/src/foresight.ts
  // ========================================================================

  // 2a. handleResponse<T>(res): make schema required + validate.
  {
    file: 'packages/pixelated-sdk/src/foresight.ts',
    find: `async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: unknown
    try {
      body = await res.json()
    } catch {
      body = undefined
    }
    throw new ForesightClientError(
      \`Foresight API error \${res.status}: \${res.statusText}\`,
      res.status,
      body,
    )
  }
  return (await res.json()) as T
}`,
    replace: `async function handleResponse<T>(
  res: Response,
  schema: z.ZodType<T>,
): Promise<T> {
  if (!res.ok) {
    let body: unknown
    try {
      body = await res.json()
    } catch {
      body = undefined
    }
    throw new ForesightClientError(
      \`Foresight API error \${res.status}: \${res.statusText}\`,
      res.status,
      body,
    )
  }
  return schema.parse(await res.json())
}`,
  },

  // 2b. storeMemory: pass StoreMemoryOutput schema.
  {
    file: 'packages/pixelated-sdk/src/foresight.ts',
    find: `  async storeMemory(
    input: z.infer<typeof StoreMemoryInput>,
  ): Promise<z.infer<typeof StoreMemoryOutput>> {
    const validated = StoreMemoryInput.parse(input)
    const res = await this.request('', {
      method: 'POST',
      body: JSON.stringify(validated),
    })
    return handleResponse(res) as Promise<z.infer<typeof StoreMemoryOutput>>
  }`,
    replace: `  async storeMemory(
    input: z.infer<typeof StoreMemoryInput>,
  ): Promise<z.infer<typeof StoreMemoryOutput>> {
    const validated = StoreMemoryInput.parse(input)
    const res = await this.request('', {
      method: 'POST',
      body: JSON.stringify(validated),
    })
    return handleResponse(res, StoreMemoryOutput)
  }`,
  },

  // 2c. getMemory: pass ForesightMemory schema.
  {
    file: 'packages/pixelated-sdk/src/foresight.ts',
    find: `  async getMemory(
    input: z.infer<typeof GetMemoryInput>,
  ): Promise<z.infer<typeof ForesightMemory>> {
    const { memoryId } = GetMemoryInput.parse(input)
    const res = await this.request(\`/\${encodeURIComponent(memoryId)}\`)
    return handleResponse<{ data: z.infer<typeof ForesightMemory> }>(res).then(
      (r) => r.data,
    )
  }`,
    replace: `  async getMemory(
    input: z.infer<typeof GetMemoryInput>,
  ): Promise<z.infer<typeof ForesightMemory>> {
    const { memoryId } = GetMemoryInput.parse(input)
    const res = await this.request(\`/\${encodeURIComponent(memoryId)}\`)
    return handleResponse(res, z.object({ data: ForesightMemory })).then(
      (r) => r.data,
    )
  }`,
  },

  // 2d. queryMemories: pass ListMemoriesOutput schema.
  {
    file: 'packages/pixelated-sdk/src/foresight.ts',
    find: `  async queryMemories(
    input: z.infer<typeof QueryMemoriesInput>,
  ): Promise<z.infer<typeof ListMemoriesOutput>> {
    const validated = QueryMemoriesInput.parse(input)
    const res = await this.request(
      appendQuery('/search', {
        q: validated.query,
        limit: validated.limit,
        offset: validated.offset,
        category: validated.category,
        tags: validated.tags,
      }),
    )
    return handleResponse<ListMemoriesOutput>(res)
  }`,
    replace: `  async queryMemories(
    input: z.infer<typeof QueryMemoriesInput>,
  ): Promise<z.infer<typeof ListMemoriesOutput>> {
    const validated = QueryMemoriesInput.parse(input)
    const res = await this.request(
      appendQuery('/search', {
        q: validated.query,
        limit: validated.limit,
        offset: validated.offset,
        category: validated.category,
        tags: validated.tags,
      }),
    )
    return handleResponse(res, ListMemoriesOutput)
  }`,
  },

  // 2e. listMemories: pass ListMemoriesOutput schema.
  {
    file: 'packages/pixelated-sdk/src/foresight.ts',
    find: `  async listMemories(
    input?: z.infer<typeof ListMemoriesInput>,
  ): Promise<z.infer<typeof ListMemoriesOutput>> {
    const res = await this.request(
      appendQuery('', {
        limit: input?.limit ?? 20,
        offset: input?.offset ?? 0,
        category: input?.category,
        tags: input?.tags,
      }),
    )
    return handleResponse<ListMemoriesOutput>(res)
  }`,
    replace: `  async listMemories(
    input?: z.infer<typeof ListMemoriesInput>,
  ): Promise<z.infer<typeof ListMemoriesOutput>> {
    const res = await this.request(
      appendQuery('', {
        limit: input?.limit ?? 20,
        offset: input?.offset ?? 0,
        category: input?.category,
        tags: input?.tags,
      }),
    )
    return handleResponse(res, ListMemoriesOutput)
  }`,
  },

  // 2f. updateMemory: pass ForesightMemory schema.
  {
    file: 'packages/pixelated-sdk/src/foresight.ts',
    find: `  async updateMemory(
    input: z.infer<typeof UpdateMemoryInput>,
  ): Promise<z.infer<typeof ForesightMemory>> {
    const validated = UpdateMemoryInput.parse(input)
    const { memoryId, ...body } = validated
    const res = await this.request(\`/\${encodeURIComponent(memoryId)}\`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    return handleResponse<{ data: z.infer<typeof ForesightMemory> }>(res).then(
      (r) => r.data,
    )
  }`,
    replace: `  async updateMemory(
    input: z.infer<typeof UpdateMemoryInput>,
  ): Promise<z.infer<typeof ForesightMemory>> {
    const validated = UpdateMemoryInput.parse(input)
    const { memoryId, ...body } = validated
    const res = await this.request(\`/\${encodeURIComponent(memoryId)}\`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    return handleResponse(res, z.object({ data: ForesightMemory })).then(
      (r) => r.data,
    )
  }`,
  },

  // 2g. deleteMemory: pass DeleteMemoryOutput schema.
  {
    file: 'packages/pixelated-sdk/src/foresight.ts',
    find: `  async deleteMemory(
    input: z.infer<typeof DeleteMemoryInput>,
  ): Promise<z.infer<typeof DeleteMemoryOutput>> {
    const { memoryId } = DeleteMemoryInput.parse(input)
    const res = await this.request(\`/\${encodeURIComponent(memoryId)}\`, {
      method: 'DELETE',
    })
    return handleResponse<DeleteMemoryOutput>(res)
  }`,
    replace: `  async deleteMemory(
    input: z.infer<typeof DeleteMemoryInput>,
  ): Promise<z.infer<typeof DeleteMemoryOutput>> {
    const { memoryId } = DeleteMemoryInput.parse(input)
    const res = await this.request(\`/\${encodeURIComponent(memoryId)}\`, {
      method: 'DELETE',
    })
    return handleResponse(res, DeleteMemoryOutput)
  }`,
  },

  // ========================================================================
  // 3. src/lib/sdk/index.ts
  // ========================================================================

  // 3a. Add zod import.
  {
    file: 'src/lib/sdk/index.ts',
    find: `import { MemoryApiClient } from '../memory/memory-api-client'
import { ForesightClient } from './foresight'`,
    replace: `import { z } from 'zod'

import { MemoryApiClient } from '../memory/memory-api-client'
import { ForesightClient } from './foresight'`,
  },

  // 3b. Add UserProfileSchema after UserProfileUpdate interface.
  {
    file: 'src/lib/sdk/index.ts',
    find: `export interface UserProfileUpdate {
  fullName?: string
  avatarUrl?: string
  userMetadata?: Record<string, any>
}`,
    replace: `export interface UserProfileUpdate {
  fullName?: string
  avatarUrl?: string
  userMetadata?: Record<string, any>
}

export const UserProfileSchema: z.ZodType<{
  id: string
  fullName?: string
  email: string
  role: string
  avatarUrl?: string
  createdAt: string
  lastLogin?: string
}> = z.object({
  id: z.string(),
  fullName: z.string().optional(),
  email: z.string(),
  role: z.string(),
  avatarUrl: z.string().optional(),
  createdAt: z.string(),
  lastLogin: z.string().optional(),
})`,
  },

  // 3c. request() — add schema parameter, thread to response.json(z.parse).
  {
    file: 'src/lib/sdk/index.ts',
    find: `  private async request(path: string, options: RequestInit = {}) {
    const url = \`\${this.baseUrl}\${path}\`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      ...(options.headers as Record<string, string>),
    }

    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      })

      clearTimeout(id)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error ?? \`API Error: \${response.statusText}\`)
      }

      return await response.json()
    } catch (error) {
      clearTimeout(id)
      throw error
    }
  }`,
    replace: `  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: RequestInit = {},
  ): Promise<T> {
    const url = \`\${this.baseUrl}\${path}\`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      ...(options.headers as Record<string, string>),
    }

    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      })

      clearTimeout(id)

      if (!response.ok) {
        let errorData: { error?: string } = {}
        try {
          errorData = await response.json()
        } catch {
          /* ignore */
        }
        throw new Error(errorData.error ?? \`API Error: \${response.statusText}\`)
      }

      return schema.parse(await response.json())
    } catch (error) {
      clearTimeout(id)
      throw error
    }
  }`,
  },

  // 3d. user.getProfile: pass UserProfileSchema (single profile, not wrapped).
  {
    file: 'src/lib/sdk/index.ts',
    find: `      getProfile: async () => {
        return this.request('/profile')
      },`,
    replace: `      getProfile: async () => {
        return this.request('/profile', UserProfileSchema)
      },`,
  },

  // 3e. user.updateProfile: pass UserProfileSchema.
  {
    file: 'src/lib/sdk/index.ts',
    find: `      updateProfile: async (updates: UserProfileUpdate) => {
        return this.request('/profile', {
          method: 'PUT',
          body: JSON.stringify(updates),
        })
      },`,
    replace: `      updateProfile: async (updates: UserProfileUpdate) => {
        return this.request(
          '/profile',
          UserProfileSchema,
          {
            method: 'PUT',
            body: JSON.stringify(updates),
          },
        )
      },`,
  },

  // ========================================================================
  // 4. src/lib/api/therapeutic.ts (already has Zod schemas)
  // ========================================================================

  // 4a. post<T>(endpoint, data, schema): require schema.
  {
    file: 'src/lib/api/therapeutic.ts',
    find: `  private async post<T>(endpoint: string, data: unknown): Promise<T> {
    try {
      const response = await fetch(\`\${this.baseUrl}\${endpoint}\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(\`API Error: \${response.status} \${response.statusText}\`)
      }

      return await response.json()
    } catch (error: unknown) {
      console.error(\`Therapeutic API Request Failed: \${endpoint}\`, error)
      throw error
    }
  }`,
    replace: `  private async post<T>(
    endpoint: string,
    data: unknown,
    schema: z.ZodType<T>,
  ): Promise<T> {
    try {
      const response = await fetch(\`\${this.baseUrl}\${endpoint}\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(\`API Error: \${response.status} \${response.statusText}\`)
      }

      return schema.parse(await response.json())
    } catch (error: unknown) {
      console.error(\`Therapeutic API Request Failed: \${endpoint}\`, error)
      throw error
    }
  }`,
  },

  // 4b. validateEmotion: pass ValidationResultSchema.
  {
    file: 'src/lib/api/therapeutic.ts',
    find: `  async validateEmotion(data: EmotionData): Promise<ValidationResult> {
    return this.post<ValidationResult>('/api/emotion/validate', data)
  }`,
    replace: `  async validateEmotion(data: EmotionData): Promise<ValidationResult> {
    return this.post<ValidationResult>(
      '/api/emotion/validate',
      data,
      ValidationResultSchema,
    )
  }`,
  },

  // 4c. detectCrisis: pass CrisisResultSchema.
  {
    file: 'src/lib/api/therapeutic.ts',
    find: `  async detectCrisis(text: string, sessionId?: string): Promise<CrisisResult> {
    return this.post<CrisisResult>('/api/security/detect-crisis', {
      text,
      session_id: sessionId,
    })
  }`,
    replace: `  async detectCrisis(text: string, sessionId?: string): Promise<CrisisResult> {
    return this.post<CrisisResult>(
      '/api/security/detect-crisis',
      { text, session_id: sessionId },
      CrisisResultSchema,
    )
  }`,
  },

  // 4d. analyzeBias: pass BiasResultSchema.
  {
    file: 'src/lib/api/therapeutic.ts',
    find: `  async analyzeBias(data: Record<string, unknown>): Promise<BiasResult> {
    return this.post<BiasResult>('/api/bias/analyze-session', data)
  }`,
    replace: `  async analyzeBias(data: Record<string, unknown>): Promise<BiasResult> {
    return this.post<BiasResult>(
      '/api/bias/analyze-session',
      data,
      BiasResultSchema,
    )
  }`,
  },

  // 4e. scrubPII: pass PIIScrubResultSchema.
  {
    file: 'src/lib/api/therapeutic.ts',
    find: `  async scrubPII(text: string, sessionId?: string): Promise<PIIScrubResult> {
    return this.post<PIIScrubResult>('/api/security/scrub-pii', {
      text,
      session_id: sessionId,
    })
  }`,
    replace: `  async scrubPII(text: string, sessionId?: string): Promise<PIIScrubResult> {
    return this.post<PIIScrubResult>(
      '/api/security/scrub-pii',
      { text, session_id: sessionId },
      PIIScrubResultSchema,
    )
  }`,
  },

  // 4f. healthCheck: define a HealthResponse schema + use it.
  {
    file: 'src/lib/api/therapeutic.ts',
    find: `  async healthCheck(): Promise<{
    status: string
    service: string
    mode: string
  }> {
    try {
      const response = await fetch(\`\${this.baseUrl}/health\`)
      return await response.json()
    } catch (error: unknown) {
      console.error('Health check failed', error)
      throw error
    }
  }`,
    replace: `  async healthCheck(): Promise<{
    status: string
    service: string
    mode: string
  }> {
    const HealthSchema = z.object({
      status: z.string(),
      service: z.string(),
      mode: z.string(),
    })
    try {
      const response = await fetch(\`\${this.baseUrl}/health\`)
      return HealthSchema.parse(await response.json())
    } catch (error: unknown) {
      console.error('Health check failed', error)
      throw error
    }
  }`,
  },
]

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

let failures = 0
const LOG_PREFIX = '  '

for (const { file, find, replace } of edits) {
  let content
  try {
    content = readFileSync(file, 'utf8')
  } catch (e) {
    console.error(`${LOG_PREFIX}❌ read failed: ${file}: ${e.message}`)
    failures++
    continue
  }

  const occurrences = content.split(find).length - 1
  if (occurrences === 0) {
    console.error(`${LOG_PREFIX}❌ anchor not found in ${file}:`)
    console.error(`${LOG_PREFIX}   --- expected start: ${JSON.stringify(find.slice(0, 80))}…`)
    failures++
    continue
  }
  if (occurrences > 1) {
    console.error(
      `${LOG_PREFIX}❌ anchor appears ${occurrences}× in ${file}; not patching (refusing to patch wrong site).`,
    )
    failures++
    continue
  }

  writeFileSync(file, content.replace(find, replace))
  console.log(`${LOG_PREFIX}✓ patched: ${file}`)
}

if (failures > 0) {
  console.error(`\n${failures} edit(s) failed`)
  process.exit(2)
}

console.log(`\nAll ${edits.length} edits applied successfully.`)
