/**
 * Developer API Key endpoints: /developer/api-keys, /developer/api-keys/{keyId}
 */

import type { AutoSdkClient } from "../client";
import type {
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  ListApiKeysResponse,
} from "../types";

export class ApiKeysModule {
  constructor(private readonly client: AutoSdkClient) {}

  /** GET /developer/api-keys */
  list(): Promise<ApiKey[]> {
    return this.client
      .request<ListApiKeysResponse>("GET", "/developer/api-keys")
      .then((r) => r.keys);
  }

  /** POST /developer/api-keys */
  create(request: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
    return this.client.request<CreateApiKeyResponse>("POST", "/developer/api-keys", {
      body: request,
    });
  }

  /** DELETE /developer/api-keys/{keyId} */
  revoke(keyId: string): Promise<void> {
    return this.client.request<void>("DELETE", `/developer/api-keys/${encodeURIComponent(keyId)}`);
  }
}
