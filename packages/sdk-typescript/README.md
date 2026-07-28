# @pixelated-empathy/auto-sdk

Auto-generated TypeScript SDK for the Pixelated Empathy API.

> **Source of truth**: `src/pages/docs/api/_openapi.yaml`. Method bindings in
> `src/endpoints/*` mirror every path in that spec.

## Installation

```bash
pnpm add @pixelated-empathy/auto-sdk
```

## Quick Start

```typescript
import { createPixelatedClient } from '@pixelated-empathy/auto-sdk'

const sdk = createPixelatedClient({
  baseUrl: 'https://api.pixelatedempathy.com/api/v1',
  apiKey: process.env.PIXELATED_API_KEY,
})

const profile = await sdk.user.getProfile()
const results = await sdk.content.search('therapy techniques')
const stats = await sdk.memory.getStats()
```

The factory returns a `PixelatedAutoSdk` instance with one strongly-typed module
per OpenAPI tag: `system`, `user`, `content`, `biasAnalysis`, `memory`,
`apiKeys`, `admin`. All modules share the same underlying `AutoSdkClient`, so
auth, base URL, retries, and timeouts are configured once.

## Authentication

### API Key (server-to-server)

```typescript
const sdk = createPixelatedClient({
  apiKey: process.env.PIXELATED_API_KEY,
})
```

Sent as `X-API-Key` on every request.

### JWT (browser session)

```typescript
const sdk = createPixelatedClient({
  jwt: userSessionToken,
})
```

Sent as `Authorization: Bearer <jwt>`.

API key takes precedence over JWT when both are provided.

## Endpoint Modules

| Module             | Methods                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `sdk.system`       | `getHealth()`, `getVersion()`                                                                                                 |
| `sdk.user`         | `getProfile()`, `updateProfile()`, `getPreferences()`, `updatePreferences()`                                                  |
| `sdk.content`      | `search(q, filters?)`                                                                                                         |
| `sdk.biasAnalysis` | `analyze(request)`                                                                                                            |
| `sdk.memory`       | `list(params?)`, `create(req)`, `search(params)`, `searchPost(req)`, `get(id)`, `update(id, req)`, `delete(id)`, `getStats()` |
| `sdk.apiKeys`      | `list()`, `create(req)`, `revoke(keyId)`                                                                                      |
| `sdk.admin`        | `listUsers(params?)`                                                                                                          |

## Configuration

```typescript
interface AutoSdkConfig {
  baseUrl?: string // default: https://api.pixelatedempathy.com/api/v1
  apiKey?: string // X-API-Key header
  jwt?: string // Authorization: Bearer header
  timeout?: number // ms, default 30_000
  maxRetries?: number // default 3, only on 429 / network / abort
  retryDelay?: number // base ms for exponential backoff, default 1_000
}
```

The client honors `Retry-After` (seconds) on `429 Too Many Requests` responses
before falling back to exponential backoff.

## Errors

```typescript
import { AutoSdkError } from '@pixelated-empathy/auto-sdk'

try {
  await sdk.user.getProfile()
} catch (err) {
  if (err instanceof AutoSdkError) {
    console.error(err.status, err.code, err.details)
  }
  throw err
}
```

`AutoSdkError` extends `Error` with `status: number`, `code: string`, and
`details?: unknown` (the raw error body when the server returned JSON).

## Custom Requests

For endpoints not yet covered by a module, the underlying client is exposed:

```typescript
const sdk = createPixelatedClient({ apiKey })
const data = await sdk.client.request<MyType>('GET', '/some/custom/path')
```

## Versioning

SDK versions are tied to the API version from the OpenAPI spec. The current
API version is `1.0.0` (API v1). See
`src/content-store/docs/api/api-versioning.md` for deprecation and sunset policy.

## License

MIT
