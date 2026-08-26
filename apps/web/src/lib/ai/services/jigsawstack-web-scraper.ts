import { JigsawStack } from 'jigsawstack'

import { config } from '../../../config/env.config'

type JigsawStackClient = ReturnType<typeof JigsawStack>
export type JigsawAiScrapeParams = Parameters<
  JigsawStackClient['web']['ai_scrape']
>[0]
export type JigsawAiScrapeResponse = Awaited<
  ReturnType<JigsawStackClient['web']['ai_scrape']>
>

function assertValidHttpUrl(rawUrl: string): void {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL provided for JigsawStack AI scrape')
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed for JigsawStack AI scrape')
  }
}

export function createJigsawStackClient(apiKey?: string): JigsawStackClient {
  const resolvedApiKey = apiKey ?? config.ai.jigsawstackApiKey()

  if (!resolvedApiKey) {
    throw new Error(
      'JIGSAWSTACK_API_KEY is not configured. Replace the example API key with your own JigsawStack key.',
    )
  }

  return JigsawStack({
    apiKey: resolvedApiKey,
  })
}

export async function aiScrapeWithJigsawStack(
  params: JigsawAiScrapeParams,
  apiKey?: string,
): Promise<JigsawAiScrapeResponse> {
  if (!params.url) {
    throw new Error('The "url" field is required for ai_scrape')
  }

  assertValidHttpUrl(params.url)

  const jigsaw = createJigsawStackClient(apiKey)
  return jigsaw.web.ai_scrape(params)
}

export async function scrapeHackerNewsShowPosts(
  apiKey?: string,
): Promise<JigsawAiScrapeResponse> {
  return aiScrapeWithJigsawStack(
    {
      url: 'https://news.ycombinator.com/show',
      element_prompts: ['post title', 'post points'],
    },
    apiKey,
  )
}
