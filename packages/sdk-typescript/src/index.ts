/**
 * Pixelated Empathy Auto SDK
 *
 * Auto-generated TypeScript SDK for the Pixelated Empathy API.
 * Method bindings are generated from the OpenAPI specification at
 * `src/pages/docs/api/_openapi.yaml`.
 *
 * Usage:
 *   import { createPixelatedClient } from "@pixelated-empathy/auto-sdk";
 *   const sdk = createPixelatedClient({ apiKey: process.env.PIXELATED_API_KEY });
 *   const profile = await sdk.user.getProfile();
 *   const results = await sdk.content.search("therapy techniques");
 */

export {
  AutoSdkClient,
  AutoSdkError,
  type AutoSdkConfig,
  type QueryParams,
  type QueryParamValue,
} from "./client.js";

export * from "./types.js";

import { AutoSdkClient, type AutoSdkConfig } from "./client.js";
import { SystemModule } from "./endpoints/system.js";
import { UserModule } from "./endpoints/user.js";
import { ContentModule } from "./endpoints/content.js";
import { BiasAnalysisModule } from "./endpoints/bias-analysis.js";
import { MemoryModule } from "./endpoints/memory.js";
import { ApiKeysModule } from "./endpoints/api-keys.js";
import { AdminModule } from "./endpoints/admin.js";

/**
 * Aggregate SDK facade. One instance exposes all endpoint groups as
 * strongly-typed properties. Modules share the same `AutoSdkClient`, so auth,
 * base URL, retries, and timeouts are configured once.
 */
export class PixelatedAutoSdk {
  readonly system: SystemModule;
  readonly user: UserModule;
  readonly content: ContentModule;
  readonly biasAnalysis: BiasAnalysisModule;
  readonly memory: MemoryModule;
  readonly apiKeys: ApiKeysModule;
  readonly admin: AdminModule;
  /** Underlying HTTP client — exposed for escape-hatch custom requests. */
  readonly client: AutoSdkClient;

  constructor(config: AutoSdkConfig = {}) {
    this.client = new AutoSdkClient(config);
    this.system = new SystemModule(this.client);
    this.user = new UserModule(this.client);
    this.content = new ContentModule(this.client);
    this.biasAnalysis = new BiasAnalysisModule(this.client);
    this.memory = new MemoryModule(this.client);
    this.apiKeys = new ApiKeysModule(this.client);
    this.admin = new AdminModule(this.client);
  }
}

/**
 * Convenience factory. Equivalent to `new PixelatedAutoSdk(config)`.
 */
export function createPixelatedClient(config: AutoSdkConfig = {}): PixelatedAutoSdk {
  return new PixelatedAutoSdk(config);
}
