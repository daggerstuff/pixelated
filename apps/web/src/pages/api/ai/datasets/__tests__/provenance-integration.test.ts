/* @vitest-environment node */
/**
 * Integration tests for provenance-aware dataset endpoints.
 *
 * Covers the provenance business logic at the API handler level:
 *  - POST /api/ai/datasets/merge — returns provenance in body + header
 *  - POST /api/ai/datasets/prepare — validates parentMergeRunId against store
 *  - GET /api/ai/datasets/lineage — returns lineage chain or error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------
// Mocks — hoisted before module imports
// ---------------------------------------------------------------

// Auth: always authenticated as admin
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth/roles", () => ({
  hasPermission: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/security", () => ({
  logSecurityEvent: vi.fn(),
}));

// Merge backend (resolves to same module as merge.ts's relative import)
vi.mock("@/lib/ai/datasets/merge-datasets", () => ({
  mergeAllDatasets: vi.fn(),
  mergedDatasetExists: vi.fn(),
  getMergedDatasetPath: vi.fn().mockReturnValue("/tmp/test-merged.jsonl"),
}));

// Prepare backend (resolves to same module as prepare.ts's relative import)
vi.mock("@/lib/ai/datasets/prepare-fine-tuning", () => ({
  prepareAllFormats: vi.fn(),
  prepareForOpenAI: vi.fn(),
  prepareForHuggingFace: vi.fn(),
  preparedDatasetsExist: vi.fn(),
}));

// ---------------------------------------------------------------
// Imports
// ---------------------------------------------------------------
import { getCurrentUser } from "@/lib/auth";
import { mergeAllDatasets, mergedDatasetExists } from "@/lib/ai/datasets/merge-datasets";
import {
  prepareAllFormats,
  prepareForOpenAI,
  prepareForHuggingFace,
  preparedDatasetsExist,
} from "@/lib/ai/datasets/prepare-fine-tuning";
import {
  MemoryProvenanceStore,
  getDefaultProvenanceStore,
  setProvenanceStore,
  type DatasetProvenance,
} from "@/lib/ai/datasets/provenance";

import { POST as MergePOST } from "../merge";
import { POST as PreparePOST } from "../prepare";
import { GET as LineageGET } from "../lineage";

// ---------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------

type AuthCtx = { request: Request };
type LineageCtx = { request: Request; url: URL };
type JsonDict = Record<string, unknown>;

const authMergePOST = MergePOST as (ctx: AuthCtx) => Promise<Response>;
const authPreparePOST = PreparePOST as (ctx: AuthCtx) => Promise<Response>;
const authLineageGET = LineageGET as (ctx: LineageCtx) => Promise<Response>;

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockMergeAllDatasets = vi.mocked(mergeAllDatasets);
const mockMergedDatasetExists = vi.mocked(mergedDatasetExists);
const mockPrepareAllFormats = vi.mocked(prepareAllFormats);
const mockPrepareForOpenAI = vi.mocked(prepareForOpenAI);
const mockPrepareForHuggingFace = vi.mocked(prepareForHuggingFace);
const mockPreparedDatasetsExist = vi.mocked(preparedDatasetsExist);

function makeUser(role = "admin", overrides: Partial<{ id: string }> = {}) {
  return {
    id: overrides.id ?? "user-123",
    role,
    accountId: "account-1",
    workspaceId: "workspace-1",
  };
}

function makeMergeRequest(body: unknown = {}): Request {
  return {
    url: "http://localhost/api/ai/datasets/merge",
    method: "POST",
    headers: new Headers({
      Authorization: "Bearer valid-token",
      "Content-Type": "application/json",
    }),
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Request;
}

function makePrepareRequest(body: unknown = {}): Request {
  return {
    url: "http://localhost/api/ai/datasets/prepare",
    method: "POST",
    headers: new Headers({
      Authorization: "Bearer valid-token",
      "Content-Type": "application/json",
    }),
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Request;
}

function makeLineageRequest(): Request {
  return {
    url: "http://localhost/api/ai/datasets/lineage",
    method: "GET",
    headers: new Headers({ Authorization: "Bearer valid-token" }),
  } as unknown as Request;
}

function makeProvenance(overrides: Partial<DatasetProvenance> = {}): DatasetProvenance {
  return {
    mergeRunId: "merge-run-1",
    sourceDatasetIds: ["src1.jsonl"],
    mergedAt: "2026-06-14T20:00:00.000Z",
    mergedByUserId: "user-123",
    qualityThresholdUsed: 0.7,
    dedupStrategy: "hybrid-bloom",
    inputHash: "abc123def456",
    childRunIds: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  setProvenanceStore(new MemoryProvenanceStore());
  mockGetCurrentUser.mockResolvedValue(makeUser());
});

afterEach(() => {
  setProvenanceStore(null);
});

// ---------------------------------------------------------------
// Merge — provenance output
// ---------------------------------------------------------------

describe("POST /api/ai/datasets/merge — provenance output", () => {
  it("includes provenance in JSON body when merge returns provenance", async () => {
    const expected = makeProvenance({ mergeRunId: "mr-001" });
    mockMergedDatasetExists.mockReturnValue(false);
    mockMergeAllDatasets.mockResolvedValue({
      totalDatasets: 2,
      totalSamples: 100,
      mergedSamples: 95,
      duplicatesRemoved: 5,
      categoriesCount: 3,
      qualityScoreAverage: 0.82,
      processingTimeMs: 1200,
      provenance: expected,
    });

    const response = await authMergePOST({ request: makeMergeRequest({}) });
    const body = (await response.json()) as JsonDict;

    expect(response.status).toBe(200);
    expect(body["provenance"]).toEqual(expected);
    expect(mockMergeAllDatasets).toHaveBeenCalledWith(
      expect.objectContaining({ mergedByUserId: "user-123" }),
    );
  });

  it("sets X-Dataset-Provenance header matching the provenance mergeRunId", async () => {
    mockMergedDatasetExists.mockReturnValue(false);
    mockMergeAllDatasets.mockResolvedValue({
      totalDatasets: 1,
      totalSamples: 50,
      mergedSamples: 48,
      duplicatesRemoved: 2,
      categoriesCount: 2,
      qualityScoreAverage: 0.9,
      processingTimeMs: 800,
      provenance: makeProvenance({ mergeRunId: "mr-002" }),
    });

    const response = await authMergePOST({ request: makeMergeRequest({}) });

    expect(response.headers.get("X-Dataset-Provenance")).toBe("mr-002");
  });

  it("returns provenance: null and no header when merge produces no provenance", async () => {
    mockMergedDatasetExists.mockReturnValue(false);
    mockMergeAllDatasets.mockResolvedValue({
      totalDatasets: 1,
      totalSamples: 10,
      mergedSamples: 10,
      duplicatesRemoved: 0,
      categoriesCount: 1,
      qualityScoreAverage: 0.75,
      processingTimeMs: 300,
    });

    const response = await authMergePOST({ request: makeMergeRequest({}) });
    const body = (await response.json()) as JsonDict;

    expect(body["provenance"]).toBeNull();
    expect(response.headers.get("X-Dataset-Provenance")).toBeNull();
  });

  it("still returns 200 when merge succeeds without provenance", async () => {
    mockMergedDatasetExists.mockReturnValue(false);
    mockMergeAllDatasets.mockResolvedValue({
      totalDatasets: 1,
      totalSamples: 5,
      mergedSamples: 5,
      duplicatesRemoved: 0,
      categoriesCount: 1,
      qualityScoreAverage: 0.8,
      processingTimeMs: 100,
    });

    const response = await authMergePOST({ request: makeMergeRequest({}) });
    const body = (await response.json()) as JsonDict;

    expect(response.status).toBe(200);
    expect(body["success"]).toBe(true);
  });
});

// ---------------------------------------------------------------
// Prepare — parentMergeRunId validation
// ---------------------------------------------------------------

describe("POST /api/ai/datasets/prepare — parentMergeRunId validation", () => {
  beforeEach(() => {
    mockMergedDatasetExists.mockReturnValue(true);
    mockPreparedDatasetsExist.mockReturnValue({ openai: false, huggingface: false });
    mockPrepareAllFormats.mockResolvedValue({
      openai: "/tmp/openai.jsonl",
      huggingface: "/tmp/hf.jsonl",
    });
    mockPrepareForOpenAI.mockResolvedValue("/tmp/openai.jsonl");
    mockPrepareForHuggingFace.mockResolvedValue("/tmp/hf.jsonl");
  });

  it("proceeds when parentMergeRunId is not provided", async () => {
    const response = await authPreparePOST({
      request: makePrepareRequest({ format: "all" }),
    });

    expect(response.status).toBe(200);
  });

  it("returns 400 when parentMergeRunId does not exist in provenance store", async () => {
    const response = await authPreparePOST({
      request: makePrepareRequest({ format: "all", parentMergeRunId: "nonexistent-run" }),
    });
    const body = (await response.json()) as JsonDict;

    expect(response.status).toBe(400);
    expect(String(body["error"])).toContain("nonexistent-run");
    expect(mockPrepareAllFormats).not.toHaveBeenCalled();
  });

  it("proceeds when parentMergeRunId exists in provenance store", async () => {
    const store = getDefaultProvenanceStore();
    await store.create(makeProvenance({ mergeRunId: "valid-merge-run" }));

    const response = await authPreparePOST({
      request: makePrepareRequest({
        format: "all",
        parentMergeRunId: "valid-merge-run",
      }),
    });
    const body = (await response.json()) as JsonDict;

    expect(response.status).toBe(200);
    expect(body["success"]).toBe(true);
    expect(mockPrepareAllFormats).toHaveBeenCalled();
  });

  it("validates parentMergeRunId for openai format", async () => {
    const store = getDefaultProvenanceStore();
    await store.create(makeProvenance({ mergeRunId: "valid-merge-openai" }));

    const response = await authPreparePOST({
      request: makePrepareRequest({ format: "openai", parentMergeRunId: "valid-merge-openai" }),
    });

    expect(response.status).toBe(200);
  });

  it("validates parentMergeRunId for huggingface format", async () => {
    const store = getDefaultProvenanceStore();
    await store.create(makeProvenance({ mergeRunId: "valid-merge-hf" }));

    const response = await authPreparePOST({
      request: makePrepareRequest({ format: "huggingface", parentMergeRunId: "valid-merge-hf" }),
    });

    expect(response.status).toBe(200);
  });
});

// ---------------------------------------------------------------
// Lineage — chain retrieval
// ---------------------------------------------------------------

describe("GET /api/ai/datasets/lineage — lineage retrieval", () => {
  it("returns full lineage chain for an existing runId", async () => {
    const store = getDefaultProvenanceStore();
    await store.create(
      makeProvenance({
        mergeRunId: "parent-run",
        childRunIds: ["child-run"],
      }),
    );
    await store.create(
      makeProvenance({
        mergeRunId: "child-run",
        parentMergeRunId: "parent-run",
      }),
    );

    const response = await authLineageGET({
      request: makeLineageRequest(),
      url: new URL("http://localhost/api/ai/datasets/lineage?runId=parent-run"),
    });
    const body = (await response.json()) as JsonDict;

    expect(response.status).toBe(200);
    expect(body["success"]).toBe(true);
    const lineage = body["lineage"] as JsonDict;
    expect((lineage["current"] as JsonDict)["mergeRunId"]).toBe("parent-run");
    expect(lineage["parent"]).toBeNull();
    expect((lineage["children"] as Array<JsonDict>)[0]["mergeRunId"]).toBe("child-run");
  });

  it("returns parent when querying a child runId", async () => {
    const store = getDefaultProvenanceStore();
    await store.create(makeProvenance({ mergeRunId: "p1" }));
    await store.create(
      makeProvenance({
        mergeRunId: "c1",
        parentMergeRunId: "p1",
      }),
    );

    const response = await authLineageGET({
      request: makeLineageRequest(),
      url: new URL("http://localhost/api/ai/datasets/lineage?runId=c1"),
    });
    const body = (await response.json()) as JsonDict;
    const lineage = body["lineage"] as JsonDict;

    expect((lineage["parent"] as JsonDict)["mergeRunId"]).toBe("p1");
    expect((lineage["current"] as JsonDict)["mergeRunId"]).toBe("c1");
  });

  it("returns 400 when runId query parameter is missing", async () => {
    const response = await authLineageGET({
      request: makeLineageRequest(),
      url: new URL("http://localhost/api/ai/datasets/lineage"),
    });
    const body = (await response.json()) as JsonDict;

    expect(response.status).toBe(400);
    expect(String(body["error"])).toContain("runId");
  });

  it("returns 404 for a non-existent runId", async () => {
    const response = await authLineageGET({
      request: makeLineageRequest(),
      url: new URL("http://localhost/api/ai/datasets/lineage?runId=nonexistent"),
    });
    const body = (await response.json()) as JsonDict;

    expect(response.status).toBe(404);
    expect(String(body["error"])).toContain("not found");
  });

  it("returns children when a parent has multiple child runs", async () => {
    const store = getDefaultProvenanceStore();
    await store.create(makeProvenance({ mergeRunId: "multi-parent" }));
    await store.create(
      makeProvenance({
        mergeRunId: "child-a",
        parentMergeRunId: "multi-parent",
      }),
    );
    await store.create(
      makeProvenance({
        mergeRunId: "child-b",
        parentMergeRunId: "multi-parent",
      }),
    );

    const response = await authLineageGET({
      request: makeLineageRequest(),
      url: new URL("http://localhost/api/ai/datasets/lineage?runId=multi-parent"),
    });
    const body = (await response.json()) as JsonDict;
    const lineage = body["lineage"] as JsonDict;

    expect(lineage["children"] as Array<unknown>).toHaveLength(2);
  });
});
