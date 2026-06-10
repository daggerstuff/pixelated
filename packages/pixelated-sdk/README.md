\n\n# @pixelated-empathy/sdk

Official TypeScript SDK for the Pixelated Empathy API.

## Installation

```bash
npm install @pixelated-empathy/sdk
```

## Quick Start

```typescript
import { PixelatedClient } from '@pixelated-empathy/sdk';

// Initialize with API key (server-side)
const client = new PixelatedClient({
  apiKey: 'pe_live_your_api_key_here',
  baseUrl: 'https://api.pixelatedempathy.com/api/v1',
});

// Or initialize with JWT (client-side)
const client = new PixelatedClient({
  jwt: 'your_jwt_token_here',
});
```

## Configuration

| Option | Default | Description |
| -------- | --------- | ------------- |
| `baseUrl` | `https://api.pixelatedempathy.com/api/v1` | API base URL |
| `apiKey` | - | API key for server-side auth |
| `jwt` | - | JWT token for user auth |
| `timeout` | `30000` | Request timeout in ms |
| `maxRetries` | `3` | Maximum retry attempts |
| `retryDelay` | `1000` | Initial retry delay in ms |

## Usage

### User Profile

```typescript
// Get profile
const profile = await client.user.getProfile();
console.log(profile.fullName, profile.email);

// Update profile
await client.user.updateProfile({
  fullName: 'New Name',
});

// Get preferences
const prefs = await client.user.getPreferences();

// Update preferences
await client.user.updatePreferences({
  theme: 'dark',
  notifications: { email: true },
});
```

### Search

```typescript
const results = await client.search.query('therapeutic techniques', {
  type: 'article',
  limit: 10,
});

results.forEach(result => {
  console.log(result.title, result.score);
});
```

### Bias Analysis

```typescript
const result = await client.biasAnalysis.analyze({
  text: 'Patient reports feeling anxious about...',
  context: 'therapy_session',
  therapistId: 'therapist_123',
});

console.log('Biases found:', result.biases);
console.log('Recommendations:', result.recommendations);
```

### Memory/Sessions

```typescript
// List sessions
const sessions = await client.memory.listSessions({ limit: 10 });

// Get session
const session = await client.memory.getSession('session_123');

// Add turn to session
await client.memory.addTurn('session_123', {
  role: 'user',
  content: 'Hello, how are you feeling today?',
});
```

### System

```typescript
// Check health
const health = await client.system.getHealth();
console.log('API status:', health.status);

// Get version
const version = await client.system.getVersion();
console.log('API version:', version.version);
```

### Developer API Keys

```typescript
// List keys
const keys = await client.apiKeys.list();

// Create key
const { key, id } = await client.apiKeys.create('My Key', ['read', 'write']);
console.log('New API key:', key); // Save this securely!

// Revoke key
await client.apiKeys.revoke('key_id');
```

## Error Handling

```typescript
import { PixelatedClient } from '@pixelated-empathy/sdk';

const client = new PixelatedClient({ apiKey: 'your_key' });

try {
  const profile = await client.user.getProfile();
} catch (error) {
  if ('status' in error) {
    // API error
    console.error('API Error:', error.status, error.message);

    if (error.status === 429) {
      // Rate limited
      console.log('Retry after:', error.retryAfter, 'ms');
    }
  } else {
    // Network error
    console.error('Network error:', error.message);
  }
}
```

## Rate Limiting

The SDK automatically handles rate limiting with exponential backoff:

- On `429 Too Many Requests`, the SDK will retry up to `maxRetries` times
- Delay between retries: `retryDelay * 2^retryCount`
- If `Retry-After` header is present, it will be used instead

To customize:

```typescript
const client = new PixelatedClient({
  apiKey: 'your_key',
  maxRetries: 5,
  retryDelay: 2000,
});
```

## Authentication

The SDK supports two authentication methods:

### API Keys (Server-side)

```typescript
const client = new PixelatedClient({
  apiKey: process.env.PIXELATED_API_KEY,
});
```

API keys are sent via `X-API-Key` header and support scopes:
- `read` - Read access to resources
- `write` - Write access to resources
- `admin` - Administrative operations

### JWT Tokens (Client-side)

```typescript
const client = new PixelatedClient({
  jwt: userToken,
});
```

JWT tokens are sent via `Authorization: Bearer` header.

## Advanced Configuration

### Custom Base URL

```typescript
const client = new PixelatedClient({
  baseUrl: 'https://custom-domain.com/api/v1',
  apiKey: 'your_key',
});
```

### Timeout Configuration

```typescript
const client = new PixelatedClient({
  timeout: 60000, // 60 seconds
});
```

### Retry Configuration

```typescript
const client = new PixelatedClient({
  maxRetries: 5,
  retryDelay: 1000,
});
```

## API Reference

| Module | Methods | Description |
| -------- | --------- | ------------- |
| `user` | `getProfile`, `updateProfile`, `getPreferences`, `updatePreferences` | User management |
| `search` | `query` | Content search |
| `biasAnalysis` | `analyze` | Bias detection |
| `memory` | `getSession`, `addTurn`, `listSessions` | Session management |
| `system` | `getHealth`, `getVersion` | System info |
| `apiKeys` | `list`, `create`, `revoke` | API key management |

## License

MIT
