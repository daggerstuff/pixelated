/** @vitest-environment node */

/**
 * Registration answers a deliberate 4xx, never a `500`, when a user cannot be
 * provisioned (VAL-IDENT-003).
 *
 * `/api/auth/register` reaches `UserManager.createUser()`. On the pinned
 * release that INSERT omitted `users.workspace_id`, which migration 011 makes
 * `NOT NULL`, so the route answered `500 {"error":"Internal server error"}`
 * with a `23502` in its log and nothing the caller could act on.
 *
 * The route must now:
 *
 *   - return the created user's id with `201` on the normal path
 *   - return a deliberate `4xx` that names the reason when the workspace cannot
 *     be resolved
 *   - still never leak a database error into the body
 *
 * The `lib/db` module is mocked, so this suite pins the route's mapping rather
 * than the SQL; the SQL half is pinned in
 * `apps/web/src/lib/db/__tests__/create-user-workspace.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCreateUser,
  mockGetUserByEmail,
  mockInitializeDatabase,
  WorkspaceResolutionErrorMock,
} = vi.hoisted(() => {
  class WorkspaceResolutionErrorMock extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'WorkspaceResolutionError'
    }
  }

  return {
    mockCreateUser: vi.fn(),
    mockGetUserByEmail: vi.fn(),
    mockInitializeDatabase: vi.fn(),
    WorkspaceResolutionErrorMock,
  }
})

vi.mock('@/lib/db', () => ({
  initializeDatabase: mockInitializeDatabase,
  userManager: {
    getUserByEmail: mockGetUserByEmail,
    createUser: mockCreateUser,
  },
}))

vi.mock('@/lib/db/workspace', () => ({
  WorkspaceResolutionError: WorkspaceResolutionErrorMock,
  DEFAULT_WORKSPACE_SLUG: 'personal',
}))

vi.mock('@/lib/auth/utils', () => ({
  hashPassword: vi.fn(async () => 'hashed-password'),
}))

import { POST } from '../route'

const USER_ID = 'b6f0f9b7-5b4f-4f6a-9f9a-3a1b2c3d4e5f'

const request = (body: unknown): Request =>
  new Request('https://pixelatedempathy.com/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const validBody = {
  fullName: 'Test Trainee',
  email: 'trainee@example.test',
  password: 'a-long-enough-password',
  termsAccepted: true,
}

const invoke = (body: unknown) =>
  (POST as unknown as (context: object) => Promise<Response>)({
    request: request(body),
  })

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUserByEmail.mockResolvedValue(null)
  mockCreateUser.mockResolvedValue(USER_ID)
})

describe('POST /api/auth/register: workspace provisioning', () => {
  it('returns 201 with the created user id on the normal path', async () => {
    const response = await invoke(validBody)
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ userId: USER_ID })
  })

  it('answers a deliberate 4xx naming the reason when no workspace exists', async () => {
    mockCreateUser.mockRejectedValue(
      new WorkspaceResolutionErrorMock(
        "Cannot provision user: no 'personal' workspace exists to assign",
      ),
    )

    const response = await invoke(validBody)

    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(response.status).toBeLessThan(500)
    const body = (await response.json()) as {
      error?: string
      code?: string
    }
    expect(body.error).toMatch(/workspace/i)
    expect(body.code).toBe('WORKSPACE_UNAVAILABLE')
    // The reason is named; the body never carries a pg error code or SQL.
    expect(JSON.stringify(body)).not.toMatch(/23502|INSERT INTO/i)
  })

  it('maps a residual 23502 on users.workspace_id to the same 4xx', async () => {
    mockCreateUser.mockRejectedValue(
      Object.assign(
        new Error('null value in column "workspace_id" violates not-null'),
        { code: '23502', column: 'workspace_id' },
      ),
    )

    const response = await invoke(validBody)

    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(response.status).toBeLessThan(500)
    const body = (await response.json()) as { error?: string; code?: string }
    expect(body.code).toBe('WORKSPACE_UNAVAILABLE')
  })

  it('keeps the 500 contract for an unexpected failure', async () => {
    mockCreateUser.mockRejectedValue(new Error('unexpected explosion'))

    const response = await invoke(validBody)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Internal server error',
    })
  })
})
