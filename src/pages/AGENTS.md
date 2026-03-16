# AGENTS.md: src/pages/

## PURPOSE

Astro file-based routing. Each `.astro` = route. `api/` contains serverless endpoints.

## STRUCTURE (KEY DIRS)

```
src/pages/
├── *.astro              # Top-level routes (/, /about, /contact)
├── admin/               # Admin dashboard (auth required)
├── ai/                  # AI chat and agent routes
├── api/                 # API endpoints (serverless functions)
│   ├── auth/
│   ├── ai/chat
│   ├── sessions/
│   └── webhooks/
├── blog/                # Blog posts (markdown, dynamic)
├── dashboard/           # User dashboard routes
├── docs/                # Documentation pages
├── journal-research/    # Research pipeline UI
├── layouts/             # Page layout templates
└── 404.astro, 500.astro # Error pages
```

## CONVENTIONS

- **Routing**: `about.astro` → `/about`; `blog/[slug].astro` → `/blog/:slug`
- **Astro pages**: `.astro` (server-rendered); embed React as needed
- **API routes**: `.ts` export `GET`, `POST`, etc.
- **Dynamic routes**: Use `getServerData` for data fetching
- **Layouts**: Wrap content; import from `../layouts/`

### Minimal Page

```astro
---
// dashboard/index.astro
import Layout from '../layouts/Dashboard.astro'
export const prerender = false
export const getServerData = async ({ redirect }) => {
  const session = await requireAuth()
  if (!session) redirect('/login')
  return { props: { session } }
}
---
<Layout><main>Dashboard</main></Layout>
```

### Minimal API

```typescript
// api/ai/chat.ts
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: 'Unauthorized' }, 401)
  const body = await request.json()
  const result = await aiService.chat(body)
  return json(result, 200)
}
```

## KEY ROUTES

| Route | File | Purpose |
|-------|------|---------|
| `/` | `index.astro` | Landing page |
| `/ai/chat` | `ai/chat.astro` | Chat interface |
| `/dashboard` | `dashboard/index.astro` | User dashboard |
| `/admin` | `admin/index.astro` | Admin console |
| `/api/*` | `api/` subdirs | REST endpoints |
| `/blog/*` | `blog/[slug].astro` | Blog posts |

## PERFORMANCE

- `prerender = true` (static) or `false` (dynamic)
- API `Cache-Control` for caching
- Streaming for large data

## SECURITY

- Auth: cookies/JWT; `locals.user` from middleware
- Authorization: role checks; enforce ownership
- Validation: Zod schemas on all inputs
- Rate limiting: on chat, auth
- CSRF: tokens for state-changing ops

## ERROR HANDLING

- `404.astro`, `500.astro`
- API: JSON `{ error, message }` with status
- Log server errors with context

## TESTING

- Pages: `@testing-library/astro`
- API: test handlers with `supertest`
- E2E: Playwright in `tests/e2e/`

## ANTI-PATTERNS

❌ Business logic in pages → services
❌ Direct AI calls → API layer
❌ Hard-coded URLs → config
❌ Silent failures → log and return errors

---

_Generated: 2025-03-15 | Domain: Astro Pages & API Routes_
