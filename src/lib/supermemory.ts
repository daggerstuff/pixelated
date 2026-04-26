import * as supermemoryTools from '@supermemory/tools/ai-sdk'

type SupermemoryModule = {
  createClient?: (
    apiKey: string | undefined,
    options?: { containerTags?: string[] },
  ) => {
    profile: (params: { containerTag: string; q: string }) => Promise<{
      profile: { static: string[]; dynamic: string[] }
      searchResults: { results: Array<{ memory: string }> } | null
    }>
    add: (params: { content: string; containerTag: string }) => Promise<unknown>
  }
}

const createClient =
  (supermemoryTools as unknown as SupermemoryModule).createClient ?? null

if (!createClient) {
  throw new Error(
    'Supermemory SDK missing createClient export; check @supermemory/tools/ai-sdk version.',
  )
}

// Initialize Supermemory client with your API key
export const supermemoryClient = createClient(process.env.SUPERMEMORY_API_KEY, {
  containerTags: ['userId'], // Individual users only
})

// Configure settings (run this once during setup)
export async function configureSupermemorySettings() {
  if (!process.env.SUPERMEMORY_API_KEY) {
    throw new Error('SUPERMEMORY_API_KEY is required')
  }

  const response = await fetch('https://api.supermemory.ai/v3/settings', {
    method: 'PATCH',
    headers: {
      'x-supermemory-api-key': process.env.SUPERMEMORY_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      shouldLLMFilter: true,
      filterPrompt: `This is a customer support bot. containerTag is userId. We store customer conversations, support tickets, and user preferences.`,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to configure Supermemory: ${response.statusText}`)
  }

  return response.json()
}

// Get profile + search context in one call (OPTION A)
export async function getContextWithProfile(
  userId: string,
  userMessage: string,
) {
  try {
    const { profile, searchResults } = await supermemoryClient.profile({
      containerTag: userId,
      q: userMessage,
    })

    const context = `
Static facts: ${profile.static.join('\n')}
Recent context: ${profile.dynamic.join('\n')}
${searchResults ? `Memories: ${searchResults.results.map((r) => r.memory).join('\n')}` : ''}
    `.trim()

    return { context, profile, searchResults }
  } catch (error: unknown) {
    console.error('Error getting Supermemory context:', error)
    return {
      context: '',
      profile: { static: [], dynamic: [] },
      searchResults: null,
    }
  }
}

// Store conversation after each interaction
export async function storeConversation(
  userId: string,
  userMessage: string,
  assistantResponse: string,
) {
  try {
    await supermemoryClient.add({
      content: `user: ${userMessage}\nassistant: ${assistantResponse}`,
      containerTag: userId,
    })
  } catch (error: unknown) {
    console.error('Error storing conversation:', error)
  }
}
