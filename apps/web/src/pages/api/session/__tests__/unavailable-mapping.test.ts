/* @vitest-environment node */
/**
 * Route-level proof that a `DatabaseUnavailableError` raised while the legacy
 * `/api/session/*` handlers acquire a pooled client answers the surface's
 * retryable `503`, not an unmapped `500`.
 *
 * Routing these routes through `acquireClient()` (PR #6676) makes the
 * availability class reachable on them: `acquireClient()` raises
 * `DatabaseUnavailableError` when two consecutive reused clients fail the
 * liveness probe, or when both acquisition attempts exceed their bound. The
 * handlers' outer catch mapped only the query-timeout class, so that failure
 * fell through to `500 Internal server error` — the same 500 class the
 * query-timeout mapping removed for the statement bound, and a hard failure on
 * `VAL-L03-011`.
 *
 * These tests drive the routes themselves against a scripted fake pool, so the
 * real `acquireClient()` runs and the failure is raised the way production
 * raises it. Against the code before the fix the acquisition cases fail with
 * `expected 500 to be 503`.
 *
 * The last group pins the rest of the surface's contract: `42P01`/`42703` stay
 * `410`, a genuine non-availability infrastructure error stays `500`, a
 * rollback failure cannot mask the mapped `503`, and no body carries a pg code,
 * statement text or table name.
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
  | { kind: 'hang' }

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
        if (behaviour.kind === 'hang') return neverSettles()
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
  DatabaseUnavailableError,
  initializeDatabase,
} from '../../../../lib/db'
import { GET as analyticsGet, POST as analyticsPost } from '../analytics'
import { GET as comparisonGet, POST as comparisonPost } from '../comparison'
import { GET as progressGet, POST as progressPost } from '../progress'
import { GET as skillsGet, POST as skillsPost } from '../skills'
import { GET as snapshotsGet, POST as snapshotsPost } from '../snapshots'

/** The provider subject `getSession()` exposes as `user.id`. */
const AUTH0_SUB = 'auth0|legacy-unavailable-caller'
/** The internal `users.id` UUID that `therapist_id` compares against. */
const USER_ID = '6cf52d73-8188-487f-a1c6-4ebc014328c0'
const SESSION_ID = '7a62430b-a01a-4eaf-8eb8-517e70ffb20d'

const LEGACY_SURFACE_CODE = 'LEGACY_SESSION_API_UNAVAILABLE'
const LEGACY_RETRYABLE_CODE = 'LEGACY_SESSION_API_TEMPORARILY_UNAVAILABLE'
const RETRYABLE_BODY = {
  error: 'Legacy session analytics are temporarily unavailable',
  code: LEGACY_RETRYABLE_CODE,
}

/** The probe statement: a trivial round trip, not a caller query. */
const PROBE = 'SELECT 1'

/** A bound short enough to keep the acquisition-timeout cases quick. */
const ACQUIRE_TIMEOUT_MS = 40

const neverSettles = () => new Promise<never>(() => {})

/**
 * Answer every statement the routes issue on a successful path.
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

/** A genuine infrastructure failure that is not a retryable availability one. */
const internalErrorHandler: QueryHandler = async () => {
  throw Object.assign(new Error('simulated internal failure'), {
    code: 'XX000',
  })
}

/** A connection loss pg reports while the transaction is open. */
const destroyedConnection = () =>
  new Error('Client has encountered a connection error and is not queryable')

type Handler = (context: never) => Promise<Response>

type Method = 'GET' | 'POST'

interface RouteSpec {
  label: string
  handlers: Record<Method, Handler>
  requests: Record<Method, () => Request>
  /** The POST opens a transaction and rolls back through `rollbackQuietly()`. */
  transactional?: boolean
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
    transactional: true,
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
    label: '/api/session/comparison',
    handlers: {
      GET: comparisonGet as unknown as Handler,
      POST: comparisonPost as unknown as Handler,
    },
    requests: {
      GET: () => get(`/api/session/comparison?sessionId=${SESSION_ID}`),
      POST: () =>
        post('/api/session/comparison', {
          currentSessionId: SESSION_ID,
          improvementScore: 12.5,
          metrics: { engagement: 0.8 },
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
    // The fifth handler on the same shared surface. It acquires through
    // `acquireClient()` for the same reason the four named routes do, and the
    // tenant matrix exercises it, so it must answer the same way.
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
    transactional: true,
  },
]

const METHODS: Method[] = ['GET', 'POST']

/**
 * Acquire a client, release it, and hand it back so the next acquisition gets
 * the same object — which is what pg does with a pooled client. The client is
 * now in `checkedOutClients`, so the liveness probe applies to it exactly as it
 * does to a warm pooled socket in production.
 */
async function acquireThenRelease(): Promise<FakeClient> {
  hooks.behaviours = [{ kind: 'resolve', queryHandler: successHandler }]
  const client = (await acquireClient()) as unknown as FakeClient
  client.release()
  client.releasedWith.length = 0
  client.queries.length = 0
  return client
}

/**
 * A warm pooled client whose peer has gone silent: the probe never answers, and
 * any caller statement on it would wait out the query bound.
 */
async function staleClient(): Promise<FakeClient> {
  const client = await acquireThenRelease()
  client.handler = async (text) => {
    if (text === PROBE) return neverSettles()
    throw new Error('Query read timeout')
  }
  return client
}

const expectRetryable = async (response: Response, method: Method) => {
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual(RETRYABLE_BODY)
  // Reads advertise a retry; a POST withholds it because its write may already
  // have committed. The availability class follows the timeout class exactly.
  expect(response.headers.get('Retry-After')).toBe(
    method === 'GET' ? '1' : null,
  )
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

  // `acquireTimeoutMillis` rides in the caller config so the rebuilt pool keeps
  // the short bound; otherwise the retry attempt would wait the 2 500 ms
  // production default and make this suite slow for no extra proof.
  initializeDatabase({
    livenessProbeTimeoutMillis: ACQUIRE_TIMEOUT_MS,
    acquireTimeoutMillis: ACQUIRE_TIMEOUT_MS,
  })
})

afterEach(async () => {
  await closeDatabase()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe.each(ROUTES)('$label client-acquisition availability', (route) => {
  it.each(METHODS)(
    '%s maps two consecutive failed liveness probes to the retryable 503',
    async (method) => {
      const first = await staleClient()
      const second = await staleClient()
      hooks.behaviours = [
        { kind: 'reuse', client: first },
        { kind: 'reuse', client: second },
      ]

      const response = await invoke(
        route.handlers[method],
        route.requests[method](),
      )

      await expectRetryable(response, method)
      // Both dead sockets saw the probe and nothing else, and were destroyed
      // rather than returned to the idle list with an unanswered statement.
      expect(first.queries).toEqual([PROBE])
      expect(first.releasedWith).toEqual([true])
      expect(second.queries).toEqual([PROBE])
      expect(second.releasedWith).toEqual([true])
    },
  )

  it.each(METHODS)(
    '%s maps two exhausted acquisition attempts to the retryable 503',
    async (method) => {
      hooks.behaviours = [{ kind: 'hang' }, { kind: 'hang' }]

      const response = await invoke(
        route.handlers[method],
        route.requests[method](),
      )

      await expectRetryable(response, method)
      // The first pool was discarded and a fresh one was built for the retry.
      expect(FakePool.instances.length).toBeGreaterThanOrEqual(2)
    },
  )

  it.each(METHODS)(
    '%s keeps the 410 mapping for absent legacy schema',
    async (method) => {
      for (const code of ['42P01', '42703']) {
        hooks.behaviours = [
          { kind: 'resolve', queryHandler: schemaErrorHandler(code) },
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
      }
    },
  )

  it.each(METHODS)(
    '%s maps a transient connection loss to the retryable 503',
    async (method) => {
      // `08006` is a connection loss, which `isDatabaseUnavailableError()`
      // classifies as the availability class. It used to answer 500; the
      // non-availability 500 case above uses a PostgreSQL internal error.
      hooks.behaviours = [
        { kind: 'resolve', queryHandler: schemaErrorHandler('08006') },
      ]

      const response = await invoke(
        route.handlers[method],
        route.requests[method](),
      )

      await expectRetryable(response, method)
    },
  )

  it.each(METHODS)(
    '%s keeps a genuine non-availability infrastructure error at 500',
    async (method) => {
      hooks.behaviours = [
        { kind: 'resolve', queryHandler: internalErrorHandler },
      ]

      const response = await invoke(
        route.handlers[method],
        route.requests[method](),
      )

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Internal server error' })
    },
  )
})

describe('retryable body hygiene', () => {
  const FORBIDDEN = [
    '42P01',
    '42703',
    '57014',
    'DB_UNAVAILABLE',
    'liveness',
    'Pooled',
    'acquired',
    'attempts',
    'SELECT',
    'sessions',
    'evaluations',
    'skill_development',
    'session_comparisons',
    'session_analytics',
    'progress_metrics',
    'progress_snapshots',
    'skill_scores',
  ]

  it.each(ROUTES)(
    '$label carries no pg code, statement text or table name on a 503',
    async (route) => {
      const first = await staleClient()
      const second = await staleClient()
      hooks.behaviours = [
        { kind: 'reuse', client: first },
        { kind: 'reuse', client: second },
      ]

      const response = await invoke(route.handlers.GET, route.requests.GET())
      const raw = await response.text()

      expect(response.status).toBe(503)
      for (const needle of FORBIDDEN) {
        expect(raw).not.toContain(needle)
      }
    },
  )
})

describe('rollback path cannot mask the mapped response', () => {
  const TRANSACTIONAL = ROUTES.filter((route) => route.transactional === true)

  it.each(TRANSACTIONAL)(
    '$label answers the retryable 503 when the ownership read loses the database',
    async (route) => {
      hooks.behaviours = [
        {
          kind: 'resolve',
          queryHandler: async (text) => {
            if (text === 'BEGIN') return { rows: [], rowCount: 0 }
            if (text === 'ROLLBACK') throw destroyedConnection()
            if (text.includes('FOR UPDATE')) {
              throw new DatabaseUnavailableError(
                'Database connection could not be acquired within 40ms per attempt (2 attempts)',
              )
            }
            return { rows: [], rowCount: 1 }
          },
        },
      ]

      const response = await invoke(route.handlers.POST, route.requests.POST())

      await expectRetryable(response, 'POST')
      // The client is destroyed rather than returned with an open transaction,
      // and a ROLLBACK on the dead socket never replaces the original error.
      const client = FakePool.instances.at(-1)?.clients.at(-1)
      expect(client?.queries).not.toContain('ROLLBACK')
      expect(client?.releasedWith).toEqual([true])
    },
  )
})
