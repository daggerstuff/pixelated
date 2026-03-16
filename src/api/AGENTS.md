# AGENTS.md: src/api/

## PURPOSE

Backend API service layer within Astro server. Provides REST endpoints, middleware, business logic. Facade to Python AI microservices.

## STRUCTURE

```
src/api/
├── server.ts            # Server setup
├── middleware/          # auth, errorHandler, rateLimit, cors, validation
├── routes/              # API handlers by domain
│   ├── auth/           # Login, logout, refresh
│   ├── ai/             # Chat/inference
│   ├── bias/           # Bias detection
│   ├── crisis/         # Crisis detection
│   ├── datasets/       # Dataset CRUD
│   ├── sessions/       # Session management
│   ├── users/          # User profiles
│   ├── analytics/      # Metrics
│   ├── webhooks/       # External webhooks
│   └── health/         # Health check
└── services/            # Business logic (ai.service.ts, session.service.ts, etc.)
```

## CONVENTIONS

- RESTful: resources as nouns; proper HTTP verbs
- JSON: snake_case keys; error format `{ error, message }`
- Handler pattern: auth check → validate → service → response
- Middleware order: cors → compression → helmet → rateLimit → auth → validation → errorHandler
- Services encapsulate business logic (not in route handlers)

### Minimal Handler

```typescript
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: 'Unauthorized' }, 401)
  const data = await request.json()
  const result = await service.operation(data)
  return json(result, 200)
}
```

## ENDPOINT LOCATION

| Concern       | Location          | Example                  |
|---------------|-------------------|--------------------------|
| Auth          | routes/auth/      | POST /api/auth/login     |
| AI Chat       | routes/ai/chat.ts | POST /api/ai/chat        |
| Bias          | routes/bias/      | POST /api/bias/analyze   |
| Crisis        | routes/crisis/    | POST /api/crisis/detect  |
| Sessions      | routes/sessions/  | GET /api/sessions        |
| Webhooks      | routes/webhooks/  | POST /api/webhooks/stripe|
| Health        | routes/health.ts  | GET /api/health          |

## SECURITY

- Auth: HttpOnly cookies or Authorization header; `locals.user`
- Authorization: Role checks; enforce resource ownership
- Validation: Zod schemas required on all inputs
- Rate limiting: On chat, auth, sensitive endpoints
- Logging: Audit log sensitive ops; never log PII

## PERFORMANCE

- Connection pooling (DB)
- Redis caching (common queries)
- gzip/brotli compression
- AI timeouts: 5s with fallback
- Health checks: `/api/health` for orchestration

## TESTING

- Unit: test services & utilities in isolation
- Integration: test routes with mocked requests
- E2E: Playwright covers full stack
- Use `createMockContext()` helper

## ANTI-PATTERNS

❌ Logic in route handlers → `services/`
❌ Synchronous blocking → always async
❌ Hard-coded URLs → use config/env
❌ Silent failures → always log context
❌ Expose stack traces in production

---

_Generated: 2025-03-15 | Domain: Astro API Routes_
