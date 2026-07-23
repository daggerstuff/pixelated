# @pixelated-empathy/auto-sdk

Auto-generated TypeScript SDK for the Pixelated Empathy API.

> **Note**: This SDK is generated from the OpenAPI specification at `docs/api-reference/openapi.yaml`.
> Do not edit generated code manually. Run `scripts/ci/generate-sdks.sh` to regenerate.

## Installation

```bash
npm install @pixelated-empathy/auto-sdk
```

## Quick Start

```typescript
import { Configuration, DefaultApi } from '@pixelated-empathy/auto-sdk';

const config = new Configuration({
  basePath: 'https://api.pixelatedempathy.com',
  apiKey: 'your-api-key', // or accessToken for JWT
});

const api = new DefaultApi(config);

// Search content
const results = await api.searchContent({ q: 'therapy techniques' });

// Get profile
const profile = await api.getProfile();

// Analyze bias
const biasResult = await api.analyzeBias({
  text: 'Patient reports feeling anxious...',
  context: 'therapy_session',
});
```

## Authentication

### API Key (Server-side)

```typescript
const config = new Configuration({
  apiKey: process.env.PIXELATED_API_KEY,
});
```

### JWT (Client-side)

```typescript
const config = new Configuration({
  accessToken: userToken,
});
```

## Versioning

SDK versions are tied to the API version from the OpenAPI spec.
The current API version is `1.0.0` (API v1).

See [API Versioning Policy](../../src/content-store/docs/api/api-versioning.md) for
deprecation and sunset information.

## Regeneration

```bash
# Requires Java 17+
./scripts/ci/generate-sdks.sh
```

## License

MIT
