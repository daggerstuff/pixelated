// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  InternalMemoryServiceError,
  type InternalMemoryServiceClient,
} from "../server/internal-memory-service-client";
import { ProductMemoryGateway, ProductMemoryGatewayError } from "./product-memory-gateway";

function createClientMock() {
  return {
    addMemory: vi.fn(),
    listMemories: vi.fn(),
    searchMemories: vi.fn(),
    updateMemory: vi.fn(),
    getMemory: vi.fn(),
    deleteMemory: vi.fn(),
    getMemoryStats: vi.fn(),
  } satisfies Partial<InternalMemoryServiceClient>;
}

describe("ProductMemoryGateway", () => {
  const scope = {
    userId: "vivi",
    orgId: "pixelated",
    projectId: "memory",
    sessionId: "sess-123",
    agentId: "agent-456",
    runId: "run-789",
    includeShared: true,
  };

  let client: ReturnType<typeof createClientMock>;
  let gateway: ProductMemoryGateway;

  beforeEach(() => {
    client = createClientMock();
    gateway = new ProductMemoryGateway(client);
  });

  it("creates a memory and preserves metadata on the product boundary", async () => {
    client.addMemory.mockResolvedValue({ memory_id: "mem-1" });

    await expect(
      gateway.createMemory({
        ...scope,
        content: "Vivi prefers direct summaries",
        metadata: { category: "preference", source: "product" },
      }),
    ).resolves.toEqual({
      id: "mem-1",
      content: "Vivi prefers direct summaries",
      metadata: { category: "preference", source: "product" },
    });

    expect(client.addMemory).toHaveBeenCalledWith({
      ...scope,
      accountId: undefined,
      workspaceId: undefined,
      content: "Vivi prefers direct summaries",
      category: "preference",
      metadata: { category: "preference", source: "product" },
    });
  });

  it("maps shared-service records into product records", async () => {
    client.listMemories.mockResolvedValue({
      count: 1,
      memories: [
        {
          id: "mem-2",
          memory: "Shared-service content",
          metadata: { visibility: "private" },
          created_at: "2026-04-06T00:00:00.000Z",
          updatedAt: "2026-04-06T01:00:00.000Z",
        },
      ],
    });

    await expect(
      gateway.listMemories({
        ...scope,
        limit: 25,
        offset: 5,
      }),
    ).resolves.toEqual({
      total: 1,
      memories: [
        {
          id: "mem-2",
          content: "Shared-service content",
          metadata: { visibility: "private" },
          createdAt: "2026-04-06T00:00:00.000Z",
          updatedAt: "2026-04-06T01:00:00.000Z",
        },
      ],
    });
  });

  it("checks ownership before updating a memory", async () => {
    client.getMemory.mockResolvedValue({
      id: "mem-3",
      content: "existing",
      metadata: {},
    });
    client.updateMemory.mockResolvedValue(undefined);

    await gateway.updateMemory({
      ...scope,
      memoryId: "mem-3",
      content: "updated",
      metadata: { source: "product" },
    });

    expect(client.getMemory).toHaveBeenCalledWith({
      ...scope,
      accountId: undefined,
      workspaceId: undefined,
      memoryId: "mem-3",
    });
    expect(client.updateMemory).toHaveBeenCalledWith({
      ...scope,
      accountId: undefined,
      workspaceId: undefined,
      memoryId: "mem-3",
      content: "updated",
      metadata: { source: "product" },
    });
  });

  it("surfaces a 404 when updating a memory outside the caller scope", async () => {
    client.getMemory.mockResolvedValue(null);

    await expect(
      gateway.updateMemory({
        ...scope,
        memoryId: "missing",
        content: "updated",
      }),
    ).rejects.toMatchObject({
      name: "ProductMemoryGatewayError",
      status: 404,
      message: "Memory not found",
    } satisfies Partial<ProductMemoryGatewayError>);
  });

  it("wraps shared-service failures in a ProductMemoryGatewayError", async () => {
    client.searchMemories.mockRejectedValue(
      new InternalMemoryServiceError("upstream failed", 502, {
        error: "bad gateway",
      }),
    );

    await expect(
      gateway.searchMemories({
        ...scope,
        query: "hello",
        limit: 10,
      }),
    ).rejects.toMatchObject({
      name: "ProductMemoryGatewayError",
      status: 502,
      message: "upstream failed",
      details: { error: "bad gateway" },
    } satisfies Partial<ProductMemoryGatewayError>);
  });

  it("passes accountId and workspaceId to internal memory service", async () => {
    const scopeWithIds = {
      ...scope,
      accountId: "acc-123",
      workspaceId: "ws-456",
    };

    client.addMemory.mockResolvedValue({ memory_id: "mem-3" });

    await gateway.createMemory({
      ...scopeWithIds,
      content: "Test memory with IDs",
    });

    expect(client.addMemory).toHaveBeenCalledWith({
      userId: scope.userId,
      accountId: "acc-123",
      workspaceId: "ws-456",
      orgId: scope.orgId,
      projectId: scope.projectId,
      sessionId: scope.sessionId,
      agentId: scope.agentId,
      runId: scope.runId,
      includeShared: scope.includeShared,
      content: "Test memory with IDs",
      category: undefined,
      metadata: {},
    });
  });

  it("passes undefined accountId and workspaceId when not provided", async () => {
    const scopeWithoutIds = {
      ...scope,
      accountId: undefined,
      workspaceId: undefined,
    };

    client.addMemory.mockResolvedValue({ memory_id: "mem-4" });

    await gateway.createMemory({
      ...scopeWithoutIds,
      content: "Test memory without IDs",
    });

    expect(client.addMemory).toHaveBeenCalledWith({
      userId: scope.userId,
      accountId: undefined,
      workspaceId: undefined,
      orgId: scope.orgId,
      projectId: scope.projectId,
      sessionId: scope.sessionId,
      agentId: scope.agentId,
      runId: scope.runId,
      includeShared: scope.includeShared,
      content: "Test memory without IDs",
      category: undefined,
      metadata: {},
    });
  });

  it("passes only accountId when workspaceId is not provided", async () => {
    const scopeWithAccountOnly = {
      ...scope,
      accountId: "acc-789",
      workspaceId: undefined,
    };

    client.addMemory.mockResolvedValue({ memory_id: "mem-5" });

    await gateway.createMemory({
      ...scopeWithAccountOnly,
      content: "Test memory with account only",
    });

    expect(client.addMemory).toHaveBeenCalledWith({
      userId: scope.userId,
      accountId: "acc-789",
      workspaceId: undefined,
      orgId: scope.orgId,
      projectId: scope.projectId,
      sessionId: scope.sessionId,
      agentId: scope.agentId,
      runId: scope.runId,
      includeShared: scope.includeShared,
      content: "Test memory with account only",
      category: undefined,
      metadata: {},
    });
  });

  it("passes only workspaceId when accountId is not provided", async () => {
    const scopeWithWorkspaceOnly = {
      ...scope,
      accountId: undefined,
      workspaceId: "ws-012",
    };

    client.addMemory.mockResolvedValue({ memory_id: "mem-6" });

    await gateway.createMemory({
      ...scopeWithWorkspaceOnly,
      content: "Test memory with workspace only",
    });

    expect(client.addMemory).toHaveBeenCalledWith({
      userId: scope.userId,
      accountId: undefined,
      workspaceId: "ws-012",
      orgId: scope.orgId,
      projectId: scope.projectId,
      sessionId: scope.sessionId,
      agentId: scope.agentId,
      runId: scope.runId,
      includeShared: scope.includeShared,
      content: "Test memory with workspace only",
      category: undefined,
      metadata: {},
    });
  });
});
