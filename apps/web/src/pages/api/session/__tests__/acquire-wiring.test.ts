/* @vitest-environment node */
/**
 * Route-level proof that every legacy `/api/session/*` handler acquires its
 * client through `acquireClient()`, so a reused pooled client is probed before
 * the caller's statement.
 *
 * Measured on `42653d506` / Worker `0f3d77e6` (evidence
 * `availability-remeasure-42653d506-2026-11-10.md` §7.2): all six surviving
 * hard failures in the 35-leg tenant matrix were `503` at 4 004–4 027 ms on
 * `progress`, `skills`, `analytics` and `snapshots`, and their tail events
 * carried no acquire line and no probe trip. They called
 * `getPool().connect()` directly, so the liveness probe in `lib/db` never ran
 * on the socket the statement waited out.
 *
 * These tests drive the routes themselves against a scripted fake pool:
 *
 *   - a reused client whose probe never settles is destroyed and replaced, and
 *     the caller's statement succeeds (200) instead of the route answering 503
 *   - a healthy reused client is probed once, handed out unchanged, and not
 *     destroyed
 *   - the `410` absent-schema mapping and the retryable `503` mapping are
 *     unchanged, including their `Retry-After` contract
 *
 * pg is mocked, not `lib/db`: the routes must reach the real `acquireClient()`
 * for this to prove anything. Against the pinned code the two acquisition
 * cases fail because the route borrows straight from the pool and the probe
 * statement is never issued.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type QueryHandler = (text: string, params?: unknown[]) => Promise<unknown>

interface FakeClient {
  releasedWith: unknown[]
  queries: string[]
  handler: QueryHandler
  query: (text: string, params?: unknown[]) => Promise<unknown>
  release: (destroy?: unknown) => void
}

type Behaviour =
  | { kind: 'resolve'; queryHandler?: QueryHandler }
  | { kind: 'reuse'; client: FakeClient }

const { FakePool, hooks, mockGetSession, mockResolveInternalUserId } =
  vi.hoisted(() => {
    const state = { behaviours: [] as Behaviour[] }

    const defaultHandler: QueryHandler = async () => ({
      rows: [],
      rowCount: 0,
      command: 'SELECT',
    })

    class FakePoolClient implements FakeClient {
      releasedWith: unknown[] = []
      queries: string[] = []
      handler: QueryHandler

      constructor(queryHandler?: QueryHandler) {
        this.handler = queryHandler ?? defaultHandler
      }

      query = (text: string, params?: unknown[]): Promise<unknown> => {
        this.queries.push(text)
        return this.handler(text, params)
      }

      release = (destroy?: unknown) => {
        this.releasedWith.push(destroy)
      }
    }

    class FakePool {
      static instances: FakePool[] = []

      readonly options: Record<string, unknown>
      readonly clients: FakePoolClient[] = []
      ended = false
      private connectListener: ((client: FakePoolClient) => void) | null = null

      constructor(options: Record<string, unknown>) {
        this.options = options
        FakePool.instances.push(this)
      }

      on(event: string, listener: (arg: never) => void): this {
        if (event === 'connect') this.connectListener = listener
        return this
      }

      connect(): Promise<FakePoolClient> {
        const behaviour = state.behaviours.shift() ?? { kind: 'resolve' }
        if (behaviour.kind === 'reuse') {
          return Promise.resolve(behaviour.client)
        }
        const client = new FakePoolClient(behaviour.queryHandler)
        this.clients.push(client)
        // pg-pool emits 'connect' for a freshly created client only; a reused
        // client is handed back without the event.
        this.connectListener?.(client)
        return Promise.resolve(client)
      }

      async end(): Promise<void> {
        this.ended = true
      }
    }

    return {
      FakePool,
      hooks: state,
      mockGetSession: vi.fn(),
      mockResolveInternalUserId: vi.fn(),
    }
  })

vi.mock('pg', () => ({
  Pool: FakePool,
  PoolClient: class {},
}))

vi.mock('../../../../lib/auth/session', () => ({
  getSession: mockGetSession,
}))
vi.mock('../../../../lib/auth/internal-identity', () => ({
  resolveInternalUserId: mockResolveInternalUserId,
}))

import {
  acquireClient,
  closeDatabase,
  initializeDatabase,
} from '../../../../lib/db'
import { GET as analyticsGet, POST as analyticsPost } from '../analytics'
import { GET as progressGet, POST as progressPost } from '../progress'
import { GET as skillsGet, POST as skillsPost } from '../skills'
import { GET as snapshotsGet, POST as snapshotsPost } from '../snapshots'

/** The provider subject `getSession()` exposes as `user.id`. */
const AUTH0_SUB = 'auth0|legacy-acquire-caller'
/** The internal `users.id` UUID that `therapist_id` compares against. */
const USER_ID = '6cf52d73-8188-487f-a1c6-4ebc014328c0'
const SESSION_ID = '7a62430b-a01a-4eaf-8eb8-517e70ffb20d'

const LEGACY_SURFACE_CODE = 'LEGACY_SESSION_API_UNAVAILABLE'
const LEGACY_RETRYABLE_CODE = 'LEGACY_SESSION_API_TEMPORARILY_UNAVAILABLE'

/** The probe statement: a trivial round trip, not a caller query. */
const PROBE = 'SELECT 1'

const neverSettles = () => new Promise<never>(() => {})

/**
 * Answer every statement the four routes issue on a successful path.
 *
 * `FROM sessions` covers the ownership reads (and returns the internal UUID the
 * route compares), the progress/snapshot column reads, and the skill-score
 * read; everything else (BEGIN, COMMIT, UPDATE, INSERT) only needs a row count.
 */
const successHandler: QueryHandler = async (text) => {
  if (text === PROBE) return { rows: [], rowCount: 1 }
  if (text.includes('FROM sessions')) {
    return {
      rows: [
        {
          id: SESSION_ID,
          therapist_id: USER_ID,
          progress_metrics: { totalMessages: 1, progress: 50 },
          progress_snapshots: [],
          skill_scores: { 'Active Listening': 85 },
        },
      ],
      rowCount: 1,
    }
  }
  return { rows: [], rowCount: 1 }
}

const schemaErrorHandler =
  (code: string): QueryHandler =>
  async () => {
    throw Object.assign(new Error(`simulated schema error ${code}`), { code })
  }

const queryTimeoutHandler: QueryHandler = async () => {
  throw new Error('Query read timeout')
}

type Handler = (context: never) => Promise<Response>

type Method = 'GET' | 'POST'

interface RouteSpec {
  label: string
  handlers: Record<Method, Handler>
  requests: Record<Method, () => Request>
}

const invoke = (handler: Handler, request: Request) =>
  (handler as unknown as (value: object) => Promise<Response>)({ request })

const get = (path: string) => new Request(`http://localhost${path}`)

const post = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const ROUTES: RouteSpec[] = [
  {
    label: '/api/session/progress',
    handlers: {
      GET: progressGet as unknown as Handler,
      POST: progressPost as unknown as Handler,
    },
    requests: {
      GET: () => get(`/api/session/progress?sessionId=${SESSION_ID}`),
      POST: () =>
        post('/api/session/progress', {
          sessionId: SESSION_ID,
          progressMetrics: { totalMessages: 1, progress: 50 },
        }),
    },
  },
  {
    label: '/api/session/skills',
    handlers: {
      GET: skillsGet as unknown as Handler,
      POST: skillsPost as unknown as Handler,
    },
    requests: {
      GET: () => get(`/api/session/skills?sessionId=${SESSION_ID}`),
      POST: () =>
        post('/api/session/skills', {
          sessionId: SESSION_ID,
          skillScores: { 'Active Listening': 85 },
        }),
    },
  },
  {
    label: '/api/session/analytics',
    handlers: {
      GET: analyticsGet as unknown as Handler,
      POST: analyticsPost as unknown as Handler,
    },
    requests: {
      GET: () => get(`/api/session/analytics?sessionId=${SESSION_ID}`),
      POST: () =>
        post('/api/session/analytics', {
          sessionId: SESSION_ID,
          analyticsData: {
            sessionMetrics: [{ metricName: 'duration', metricValue: 42 }],
            skillProgress: [],
          },
        }),
    },
  },
  {
    label: '/api/session/snapshots',
    handlers: {
      GET: snapshotsGet as unknown as Handler,
      POST: snapshotsPost as unknown as Handler,
    },
    requests: {
      GET: () => get(`/api/session/snapshots?sessionId=${SESSION_ID}`),
      POST: () =>
        post('/api/session/snapshots', {
          sessionId: SESSION_ID,
          snapshots: [],
        }),
    },
  },
]

const METHODS: Method[] = ['GET', 'POST']

const lastClient = () => FakePool.instances.at(-1)?.clients.at(-1)

/**
 * Acquire a client, release it, and hand it back so the next acquisition gets
 * the same object — which is what pg does with a pooled client. The client is
 * now in `checkedOutClients`, so the probe applies to it exactly as it does to
 * a warm pooled socket in production.
 */
async function acquireThenRelease(): Promise<FakeClient> {
  hooks.behaviours = [{ kind: 'resolve', queryHandler: successHandler }]
  const client = (await acquireClient()) as unknown as FakeClient
  client.release()
  client.releasedWith.length = 0
  client.queries.length = 0
  return client
}

beforeEach(() => {
  FakePool.instances = []
  hooks.behaviours = []
  vi.clearAllMocks()
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('DATABASE_URL', '')
  vi.stubEnv('DB_HOST', 'localhost')
  // The checkout's .env sets DB_* variables; pin the defaults here so the
  // assertions below test the code, not the local environment.
  vi.stubEnv('DB_CONNECTION_TIMEOUT', '')
  vi.stubEnv('DB_ACQUIRE_TIMEOUT', '')
  vi.stubEnv('DB_STATEMENT_TIMEOUT', '')
  vi.stubEnv('DB_QUERY_TIMEOUT', '')
  vi.stubEnv('DB_LIVENESS_PROBE_TIMEOUT', '')
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)

  mockGetSession.mockResolvedValue({
    user: { id: AUTH0_SUB, email: 'caller@example.test', role: 'therapist' },
    expires: new Date(Date.now() + 60_000).toISOString(),
  })
  mockResolveInternalUserId.mockResolvedValue(USER_ID)

  initializeDatabase({ livenessProbeTimeoutMillis: 40 })
})

afterEach(async () => {
  await closeDatabase()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe.each(ROUTES)('$label client acquisition', (route) => {
  it.each(METHODS)(
    '%s destroys a reused client whose liveness probe never settles and succeeds on the replacement',
    async (method) => {
      const stale = await acquireThenRelease()
      // The socket is dead: the probe never answers, and the caller's own
      // statement would have waited out the 4 000 ms bound and answered 503.
      stale.handler = async (text) => {
        if (text === PROBE) return neverSettles()
        throw new Error('Query read timeout')
      }
      hooks.behaviours = [
        { kind: 'reuse', client: stale },
        { kind: 'resolve', queryHandler: successHandler },
      ]

      const response = await invoke(
        route.handlers[method],
        route.requests[method](),
      )

      // The caller statement ran on a client that answers.
      expect(response.status).toBe(200)

      // The dead client saw the probe and nothing else, and was destroyed
      // rather than returned to the idle list with an unanswered statement.
      expect(stale.queries).toEqual([PROBE])
      expect(stale.releasedWith).toEqual([true])

      const replacement = lastClient()
      expect(replacement).not.toBe(stale)
      expect(replacement?.queries.length).toBeGreaterThan(0)
      expect(replacement?.queries).not.toContain(PROBE)
      expect(replacement?.releasedWith).toEqual([undefined])
    },
  )

  it.each(METHODS)(
    '%s hands a healthy reused client out unchanged and does not destroy it',
    async (method) => {
      const healthy = await acquireThenRelease()
      healthy.handler = successHandler
      hooks.behaviours = [{ kind: 'reuse', client: healthy }]

      const response = await invoke(
        route.handlers[method],
        route.requests[method](),
      )

      expect(response.status).toBe(200)
      // Probed exactly once, before the caller's first statement.
      expect(healthy.queries[0]).toBe(PROBE)
      expect(healthy.queries.length).toBeGreaterThan(1)
      // Returned to the pool, not destroyed.
      expect(healthy.releasedWith).toEqual([undefined])
      expect(FakePool.instances.at(-1)?.clients).toEqual([healthy])
    },
  )

  it.each(METHODS)(
    '%s keeps the 410 mapping for absent legacy schema',
    async (method) => {
      hooks.behaviours = [
        { kind: 'resolve', queryHandler: schemaErrorHandler('42P01') },
      ]

      const response = await invoke(
        route.handlers[method],
        route.requests[method](),
      )

      expect(response.status).toBe(410)
      expect(await response.json()).toEqual({
        error: 'Legacy session analytics are not available',
        code: LEGACY_SURFACE_CODE,
      })
    },
  )

  it.each(METHODS)(
    '%s keeps the retryable 503 mapping and its Retry-After contract',
    async (method) => {
      hooks.behaviours = [
        { kind: 'resolve', queryHandler: queryTimeoutHandler },
      ]

      const response = await invoke(
        route.handlers[method],
        route.requests[method](),
      )

      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({
        error: 'Legacy session analytics are temporarily unavailable',
        code: LEGACY_RETRYABLE_CODE,
      })
      // Reads advertise a retry; a POST withholds it because its write may
      // already have committed. This contract is unchanged by the wiring.
      expect(response.headers.get('Retry-After')).toBe(
        method === 'GET' ? '1' : null,
      )
    },
  )
})
