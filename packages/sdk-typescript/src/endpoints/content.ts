/**
 * Content endpoints: /search
 */

import type { AutoSdkClient } from "../client";
import type { SearchContentResponse, SearchResult } from "../types";

export class ContentModule {
  constructor(private readonly client: AutoSdkClient) {}

  /** GET /search?q=...&type=...&limit=... */
  search(q: string, filters?: { type?: string; limit?: number }): Promise<SearchResult[]> {
    return this.client
      .request<SearchContentResponse>("GET", "/search", {
        query: {
          q,
          type: filters?.type,
          limit: filters?.limit,
        },
      })
      .then((r) => r.results);
  }
}
