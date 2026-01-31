import { createClient } from '@supermemory/tools/ai-sdk'

// Initialize Supermemory client with your API key
export const supermemoryClient = createClient(process.env.SUPERMEMORY_API_KEY, {
  containerTags: ['userId'] // Individual users only
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
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      shouldLLMFilter: true,
      filterPrompt: `This is a customer support bot. containerTag is userId. We store customer conversations, support tickets, and user preferences.`
    })
  })

    if (!response.ok) {
      throw new Error(`Failed to configure Supermemory: ${response.statusText}`)
    }

  return response.json()
}

// Get profile + search context in one call (OPTION A)
export async function getContextWithProfile(userId: string, userMessage: string) {
  try {
    const { profile, searchResults } = await supermemoryClient.profile({
      containerTag: userId,
      q: userMessage
    })

    const context = `
Static facts: ${profile.static.join('\n')}
Recent context: ${profile.dynamic.join('\n')}
${searchResults ? `Memories: ${searchResults.results.map(r => r.memory).join('\n')}` : ''}
    `.trim()

    return { context, profile, searchResults }
  } catch (error) {
    console.error('Error getting Supermemory context:', error)
    return { context: '', profile: { static: [], dynamic: [] }, searchResults: null }
  }
}

// Store conversation after each interaction
export async function storeConversation(userId: string, userMessage: string, assistantResponse: string) {
  try {
    await supermemoryClient.add({
      content: `user: ${userMessage}\nassistant: ${assistantResponse}`,
      containerTag: userId
    })
  } catch (error) {
    console.error('Error storing conversation:', error)
  }
}