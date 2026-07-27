/**
 * Memory endpoints: /memory, /memory/search, /memory/{id}, /memory/stats
 */

import type { AutoSdkClient } from "../client";
import type {
  CreateMemoryRequest,
  CreateMemoryResponse,
  GetMemoryResponse,
  ListMemoriesParams,
  ListMemoriesResponse,
  MemoryStatsResponse,
  ProductMemoryRecord,
  SearchMemoriesParams,
  SearchMemoriesPostRequest,
  SearchMemoriesResponse,
  UpdateMemoryRequest,
  UpdateMemoryResponse,
} from "../types";

export class MemoryModule {
  constructor(private readonly client: AutoSdkClient) {}

  /** GET /memory */
  list(params: ListMemoriesParams = {}): Promise<ListMemoriesResponse> {
    return this.client.request<ListMemoriesResponse>("GET", "/memory", {
      query: params,
    });
  }

  /** POST /memory */
  create(request: CreateMemoryRequest): Promise<ProductMemoryRecord> {
    return this.client
      .request<CreateMemoryResponse>("POST", "/memory", { body: request })
      .then((r) => r.memory);
  }

  /** GET /memory/search?q=... */
  search(params: SearchMemoriesParams): Promise<SearchMemoriesResponse> {
    return this.client.request<SearchMemoriesResponse>("GET", "/memory/search", { query: params });
  }

  /** POST /memory/search */
  searchPost(request: SearchMemoriesPostRequest): Promise<SearchMemoriesResponse> {
    return this.client.request<SearchMemoriesResponse>("POST", "/memory/search", { body: request });
  }

  /** GET /memory/{memoryId} */
  get(memoryId: string): Promise<ProductMemoryRecord> {
    return this.client
      .request<GetMemoryResponse>("GET", `/memory/${encodeURIComponent(memoryId)}`)
      .then((r) => r.memory);
  }

  /** PUT /memory/{memoryId} */
  update(memoryId: string, request: UpdateMemoryRequest): Promise<ProductMemoryRecord> {
    return this.client
      .request<UpdateMemoryResponse>("PUT", `/memory/${encodeURIComponent(memoryId)}`, {
        body: request,
      })
      .then((r) => r.memory);
  }

  /** DELETE /memory/{memoryId} */
  delete(memoryId: string): Promise<void> {
    return this.client.request<void>("DELETE", `/memory/${encodeURIComponent(memoryId)}`);
  }

  /** GET /memory/stats */
  getStats(): Promise<MemoryStatsResponse> {
    return this.client.request<MemoryStatsResponse>("GET", "/memory/stats");
  }
}
