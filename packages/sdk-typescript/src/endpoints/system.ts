/**
 * System endpoints: /health, /version
 */

import type { AutoSdkClient } from "../client";
import type { HealthStatus, VersionInfo } from "../types";

export class SystemModule {
  constructor(private readonly client: AutoSdkClient) {}

  /** GET /health */
  getHealth(): Promise<HealthStatus> {
    return this.client.request<HealthStatus>("GET", "/health");
  }

  /** GET /version */
  getVersion(): Promise<VersionInfo> {
    return this.client.request<VersionInfo>("GET", "/version");
  }
}
