import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import type { APIContext, APIRoute } from 'astro'

import type { AIProviderType } from '@/lib/ai/providers'
import {
  getAIServiceByProvider,
  getAvailableProviders,
  initializeProviders,
} from '@/lib/ai/providers'
import { getSession } from '@/lib/auth/session'
import {
  buildEvidenceCitations,
  buildGroundedMessages,
  createEvidenceDocument,
  EvidenceSearchIndex,
} from '@/lib/evidence-assistant/search'
import { parseEvidenceFrontmatter } from '@/lib/evidence-assistant/frontmatter'
import type { EvidenceCollection } from '@/lib/evidence-assistant/types'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('evidence-assistant')
const evidenceIndex = new EvidenceSearchIndex()
const CONTENT_ROOT = path.resolve(process.cwd(), 'src/content-store')
const PROVIDER_TYPES = ['anthropic', 'openai', 'azure-openai', 'together', 'huggingface', 'local'] as const

let isIndexed = false

type SearchBody = {
  query?: string
  limit?: number
  collection?: EvidenceCollection
  category?: string
  generateAnswer?: boolean
  provider?: AIProviderType
}

type ParsedMarkdownDocument = {
  id: string
  title: string
  body: string
  tags: string[]
  category?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isEvidenceCollection(value: unknown): value is EvidenceCollection {
  return value === 'docs' || value === 'pages'
}

function isAIProviderType(value: unknown): value is AIProviderType {
  return (
    typeof value === 'string' &&
    PROVIDER_TYPES.some((provider) => provider === value)
  )
}

async function listMarkdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        return listMarkdownFiles(entryPath)
      }

      if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
        return [entryPath]
      }

      return []
    }),
  )

  return files.flat()
}

async function loadCollectionDocuments(
  collection: EvidenceCollection,
): Promise<ParsedMarkdownDocument[]> {
  const directory = path.join(CONTENT_ROOT, collection)
  const files = await listMarkdownFiles(directory)

  return Promise.all(
    files.map(async (filePath) => {
      const raw = await readFile(filePath, 'utf8')
      const parsed = parseEvidenceFrontmatter(raw)
      const id = path
        .relative(directory, filePath)
        .replace(/\\/g, '/')
        .replace(/\.(md|mdx)$/i, '')

      return {
        id,
        title: parsed.title,
        body: parsed.body,
        tags: parsed.tags,
        category: parsed.category,
      }
    }),
  )
}

async function indexEvidenceSources(): Promise<void> {
  if (isIndexed) {
    return
  }

  const [docsEntries, pageEntries] = await Promise.all([
    loadCollectionDocuments('docs'),
    loadCollectionDocuments('pages'),
  ])

  const documents: ReturnType<typeof createEvidenceDocument>[] = []

  for (const entry of docsEntries) {
    documents.push(
      createEvidenceDocument(
        'docs',
        entry.id,
        entry.title,
        entry.body,
        entry.tags,
        entry.category ?? 'docs',
      ),
    )
  }

  for (const entry of pageEntries) {
    documents.push(
      createEvidenceDocument(
        'pages',
        entry.id,
        entry.title,
        entry.body,
        entry.tags,
        entry.category ?? 'pages',
      ),
    )
  }

  evidenceIndex.clear()
  evidenceIndex.importDocuments(documents)
  isIndexed = true
}

async function parseSearchBody(request: Request): Promise<SearchBody> {
  const payload: unknown = await request.json()
  if (!isRecord(payload)) {
    return {}
  }

  return {
    query: typeof payload.query === 'string' ? payload.query : undefined,
    limit: typeof payload.limit === 'number' ? payload.limit : undefined,
    collection: isEvidenceCollection(payload.collection)
      ? payload.collection
      : undefined,
    category: typeof payload.category === 'string' ? payload.category : undefined,
    generateAnswer:
      typeof payload.generateAnswer === 'boolean'
        ? payload.generateAnswer
        : undefined,
    provider: isAIProviderType(payload.provider) ? payload.provider : undefined,
  }
}

function pickProvider(requestedProvider?: AIProviderType): AIProviderType | null {
  initializeProviders()

  if (requestedProvider) {
    return getAIServiceByProvider(requestedProvider) ? requestedProvider : null
  }

  const candidates: AIProviderType[] = ['local', 'together', 'openai', 'anthropic']
  for (const candidate of candidates) {
    if (getAIServiceByProvider(candidate)) {
      return candidate
    }
  }

  return null
}

export const GET: APIRoute = async ({ request }: APIContext) => {
  const session = await getSession(request)
  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  initializeProviders()

  return new Response(
    JSON.stringify({
      name: 'Evidence Assistant API',
      version: '1.0.0',
      description:
        'Searches internal Pixelated Empathy docs and pages, and can synthesize grounded internal answers with citations.',
      methods: ['POST'],
      collections: ['docs', 'pages'],
      availableProviders: getAvailableProviders(),
      note: 'Internal guidance only. Not for autonomous clinical decision-making.',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

export const POST: APIRoute = async ({ request }: APIContext) => {
  try {
    const session = await getSession(request)
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await parseSearchBody(request)
    const query = body.query?.trim()

    if (!query) {
      return new Response(
        JSON.stringify({
          error: 'Validation error',
          message: 'query is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    await indexEvidenceSources()

    const results = evidenceIndex.search(query, {
      limit: body.limit,
      collection: body.collection,
      category: body.category,
    })
    const citations = buildEvidenceCitations(results)

    let answer: string | null = null
    let providerUsed: AIProviderType | null = null
    const warnings: string[] = []

    if (body.generateAnswer) {
      providerUsed = pickProvider(body.provider)
      if (!providerUsed) {
        warnings.push(
          'No configured AI provider available for grounded answer generation. Returning citations only.',
        )
      } else {
        const aiService = getAIServiceByProvider(providerUsed)
        if (!aiService) {
          warnings.push(
            `Requested provider ${providerUsed} is unavailable. Returning citations only.`,
          )
          providerUsed = null
        } else if (results.length === 0) {
          warnings.push(
            'No matching evidence found to ground an answer. Returning citations only.',
          )
        } else {
          try {
            const completion = await aiService.createChatCompletion(
              buildGroundedMessages(query, results),
              {
                temperature: 0.2,
                maxTokens: 600,
              },
            )
            answer = completion.content
          } catch (error: unknown) {
            logger.warn('Evidence assistant answer generation failed', {
              userId: session.user.id,
              provider: providerUsed,
              queryLength: query.length,
              error,
            })
            warnings.push(
              `Grounded answer generation failed at runtime for provider ${providerUsed}. Returning citations only.`,
            )
            providerUsed = null
            answer = null
          }
        }
      }
    }

    logger.info('Evidence assistant search completed', {
      userId: session.user.id,
      queryLength: query.length,
      resultCount: results.length,
      providerUsed,
      generatedAnswer: !!answer,
    })

    return new Response(
      JSON.stringify({
        query,
        answer,
        providerUsed,
        results,
        citations,
        warnings,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error: unknown) {
    logger.error('Evidence assistant failed', { error })

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message:
          error instanceof Error ? error.message : 'Unknown evidence assistant error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
