/* @vitest-environment node */
/**
 * PIX-3936: Auth enforcement on dataset merge & prepare routes
 *
 * Verifies that /api/ai/datasets/merge enforces:
 *   1. getCurrentUser(request) — 401 on invalid/missing token
 *   2. hasPermission(user.role, 'manage:training_data') — 403 on insufficient role
 *   3. logSecurityEvent('training_data_access', ...) on success
 *
 * RED phase: tests describe desired behaviour — currently fail because the
 * route only checks header presence, never calls getCurrentUser / hasPermission.
 * GREEN phase: tests pass after proper auth is wired.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------
// Mocks — hoisted before module imports
// ---------------------------------------------------------------
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth/roles", () => ({
  hasPermission: vi.fn(),
}));

vi.mock("@/lib/security", () => ({
  logSecurityEvent: vi.fn(),
}));

vi.mock("@/lib/ai/datasets/merge-datasets", () => ({
  mergeAllDatasets: vi.fn().mockResolvedValue({ format: "jsonl", path: "/mock/path" }),
  mergedDatasetExists: vi.fn().mockResolvedValue(false),
  getMergedDatasetPath: vi.fn().mockReturnValue("/mock/path"),
}));

// ---------------------------------------------------------------
// Module imports (after mocks)
// ---------------------------------------------------------------
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/roles";
import { logSecurityEvent } from "@/lib/security";

import { POST as POSTHandler, GET as GETHandler } from "../merge";

// Cast to test-friendly type — APIRoute expects full APIContext
// but tests only provide a { request } stub.
type RouteHandler = (ctx: { request: Request }) => Promise<Response>;
const POST = POSTHandler as RouteHandler;
const GET = GETHandler as RouteHandler;

// ---------------------------------------------------------------
// Mocked references
// ---------------------------------------------------------------
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockHasPermission = vi.mocked(hasPermission);
const mockLogSecurityEvent = vi.mocked(logSecurityEvent);

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

/** A minimal user shape matching getCurrentUser's return type. */
function makeUser(
  role: string,
  overrides: Partial<{ id: string; accountId: string; workspaceId: string }> = {},
) {
  return {
    id: overrides.id ?? "user-123",
    role,
    accountId: overrides.accountId ?? "account-1",
    workspaceId: overrides.workspaceId ?? "workspace-1",
  };
}

/** Build a minimal Request-like object the route can work with. */
function makeRequest(authHeader?: string, body: unknown = {}): Request {
  const headers = new Headers();
  if (authHeader) headers.set("Authorization", authHeader);
  headers.set("Content-Type", "application/json");

  return {
    url: "http://localhost/api/ai/datasets/merge",
    method: "POST",
    headers,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Request;
}

function makeGetRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) headers.set("Authorization", authHeader);
  return {
    url: "http://localhost/api/ai/datasets/merge",
    method: "GET",
    headers,
  } as unknown as Request;
}

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------
describe("PIX-3936: POST /api/ai/datasets/merge — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 401: missing / invalid token ──────────────────────────────

  it("returns 401 when no Authorization header is present", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await POST({ request: makeRequest() });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(401);
    expect(body).toHaveProperty("error");
    expect(mockLogSecurityEvent).not.toHaveBeenCalled();
  });

  it("returns 401 when getCurrentUser returns null (invalid/expired token)", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await POST({ request: makeRequest("Bearer garbage-token") });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(401);
    expect(body).toHaveProperty("error");
    expect(mockLogSecurityEvent).not.toHaveBeenCalled();
  });

  it("returns 401 when getCurrentUser returns null for malformed header", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await POST({ request: makeRequest("Bearer ") });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(401);
    expect(body).toHaveProperty("error");
    expect(mockLogSecurityEvent).not.toHaveBeenCalled();
  });

  it("returns 401 when getCurrentUser returns null for Basic auth (not Bearer)", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await POST({ request: makeRequest("Basic dGVzdDp0ZXN0") });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(401);
    expect(body).toHaveProperty("error");
    expect(mockLogSecurityEvent).not.toHaveBeenCalled();
  });

  // ── 403: authenticated but insufficient permission ────────────

  it("returns 403 when user role lacks manage:training_data (guest)", async () => {
    mockGetCurrentUser.mockResolvedValue(makeUser("guest"));
    mockHasPermission.mockReturnValue(false);

    const response = await POST({ request: makeRequest("Bearer valid-token") });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(403);
    expect(body).toHaveProperty("error");
    expect(mockLogSecurityEvent).not.toHaveBeenCalled();
  });

  it("returns 403 when user role lacks manage:training_data (patient)", async () => {
    mockGetCurrentUser.mockResolvedValue(makeUser("patient"));
    mockHasPermission.mockReturnValue(false);

    const response = await POST({ request: makeRequest("Bearer valid-token") });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(403);
    expect(body).toHaveProperty("error");
    expect(mockLogSecurityEvent).not.toHaveBeenCalled();
  });

  // ── 2xx: authenticated + permitted ────────────────────────────

  it("proceeds to business logic when admin has manage:training_data", async () => {
    mockGetCurrentUser.mockResolvedValue(makeUser("admin"));
    mockHasPermission.mockReturnValue(true);

    // The business logic may return 400 (dataset already exists etc.) — the key
    // assertion is that it is NOT 401/403 and that logSecurityEvent WAS called.
    const response = await POST({ request: makeRequest("Bearer admin-token") });

    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      "training_data_access",
      expect.any(String),
      expect.objectContaining({ op: "merge" }),
    );
  });

  it("proceeds to business logic when researcher has manage:training_data", async () => {
    mockGetCurrentUser.mockResolvedValue(makeUser("researcher"));
    mockHasPermission.mockReturnValue(true);

    const response = await POST({ request: makeRequest("Bearer researcher-token") });

    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      "training_data_access",
      expect.any(String),
      expect.objectContaining({ op: "merge" }),
    );
  });
});

describe("PIX-3936: GET /api/ai/datasets/merge — auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no Authorization header is present", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET({ request: makeGetRequest() });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(401);
    expect(body).toHaveProperty("error");
  });

  it("returns 401 when getCurrentUser returns null", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET({ request: makeGetRequest("Bearer garbage") });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(401);
    expect(body).toHaveProperty("error");
  });

  it("returns 2xx when authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(makeUser("admin"));

    const response = await GET({ request: makeGetRequest("Bearer valid-token") });

    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });
});
