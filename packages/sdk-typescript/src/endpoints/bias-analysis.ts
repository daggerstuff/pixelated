/**
 * Bias Analysis endpoints: /bias-analysis/analyze
 */

import type { AutoSdkClient } from "../client";
import type { BiasAnalysisRequest, BiasAnalysisResult } from "../types";

export class BiasAnalysisModule {
  constructor(private readonly client: AutoSdkClient) {}

  /** POST /bias-analysis/analyze */
  analyze(request: BiasAnalysisRequest): Promise<BiasAnalysisResult> {
    return this.client.request<BiasAnalysisResult>("POST", "/bias-analysis/analyze", {
      body: request,
    });
  }
}
