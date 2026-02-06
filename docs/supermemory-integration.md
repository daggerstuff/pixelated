# Supermemory Integration Guide

## Installation

```bash
npm install @supermemory/tools @ai-sdk/anthropic
```

## Environment Variables

Add to your `.env.local` file:

```env
SUPERMEMORY_API_KEY=sm_your_api_key_here
```

## Initial Setup

Run this once to configure Supermemory settings:

```bash
# In your application code
import { configureSupermemorySettings } from '@/lib/supermemory'

await configureSupermemorySettings()
```

## Usage Example

```typescript
// In your chat endpoint
import { NextRequest, NextResponse } from 'next/server'
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { supermemoryTools } from '@supermemory/tools/ai-sdk'
import { getContextWithProfile, storeConversation } from '@/lib/supermemory'

export async function POST(request: NextRequest) {
  const { userId, message } = await request.json()

  // Get context with profile + search
  const { context, profile } = await getContextWithProfile(userId, message)

  // Build messages with context
  const messages = [
    {
      role: 'system',
      content: \`User context:\nStatic facts: \${profile.static.join('\n')}\nRecent context: \${profile.dynamic.join('\n')}\`
    },
    { role: 'user', content: message }
  ]

  // Stream response with Supermemory tools
  const result = await streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    messages,
    tools: supermemoryTools(process.env.SUPERMEMORY_API_KEY, {
      containerTags: [userId]
    })
  })

  // Store conversation
  await storeConversation(userId, message, result)

  return NextResponse.json({ result })
}
```

## Key Features

1. **User Profiles**: Automatically maintained facts about users (what they like, what they're working on, preferences)
2. **Semantic Search**: Intelligent search across all stored memories
3. **Automatic Context**: Profile + search combined in one call
4. **Conversation Storage**: Automatically stores conversations for future reference
5. **File Uploads**: Automatically extracts content from PDFs, images, videos

## Testing

```bash
# 1. Configure settings
curl -X PATCH https://api.supermemory.ai/v3/settings \
  -H "x-supermemory-api-key: $SUPERMEMORY_API_KEY" \
  -d '{"shouldLLMFilter": true, "filterPrompt": "This is a customer support bot. containerTag is userId. We store customer conversations, support tickets, and user preferences."}'

# 2. Add test memory
curl -X POST https://api.supermemory.ai/v3/documents \
  -H "x-supermemory-api-key: $SUPERMEMORY_API_KEY" \
  -d '{"content": "Test", "containerTag": "test_user"}'

# 3. Get profile
curl -X POST https://api.supermemory.ai/v4/profile \
  -H "x-supermemory-api-key: $SUPERMEMORY_API_KEY" \
  -d '{"containerTag": "test_user"}'
```

## Search Modes

```typescript
// HYBRID (recommended) - searches memories + document chunks
searchMode: 'hybrid'

// MEMORIES ONLY - just extracted memories, no original text
searchMode: 'memories'
```

## File Uploads

```typescript
// Files are automatically extracted (PDFs, images with OCR, videos with transcription)
const formData = new FormData()
formData.append('file', fileBlob)
formData.append('containerTag', userId)

await fetch('https://api.supermemory.ai/v3/documents/file', {
  method: 'POST',
  headers: { 'x-supermemory-api-key': process.env.SUPERMEMORY_API_KEY },
  body: formData
})
```

## API Reference

- **profile()**: Get user profile + search context
- **add()**: Store new memories
- **search()**: Search across memories
- **fetchMemory()**: Get specific memory by ID
```

<task_progress>
- [x] Ask 5 key questions about Supermemory integration
- [x] Gather requirements for data model and integration approach
- [x] Generate complete working code based on answers
- [x] Include installation, settings config, and full integration
</task_progress>
</write_to_file>