/**
 * Gestalt Client for interacting with the Python Gestalt Fusion Engine.
 *
 * Supports both the legacy static API (direct fetch) and a new instance API
 * that routes through the application's AIService for consistent auth context
 * and observability.
 */

import { createBuildSafeLogger } from "@/lib/logging/build-safe-logger";
import type { AIService } from "@/lib/ai";

const logger = createBuildSafeLogger("gestalt-client");

export interface DialogueTurn {
  speaker: string;
  text: string;
}

export interface GestaltAnalysisRequest {
  dialogue: DialogueTurn[];
  target_utterance: string;
  plutchik_scores: Record<string, number>;
  ocean_scores: Record<string, number>;
  max_turns?: number;
}

export interface GestaltAnalysisResponse {
  defense_label: number;
  defense_label_name: string;
  defense_confidence: number;
  defense_maturity: number | null;
  defense_probabilities: Record<string, number>;

  plutchik_scores: Record<string, number>;
  dominant_emotion: string;
  dominant_emotion_intensity: number;

  ocean_scores: Record<string, number>;

  crisis_level: string;
  behavioral_prediction: string;
  persona_directive: string;
  breakthrough_score: number;
  behavioral_pattern?: string;
  behavioral_pattern_confidence?: number;
  raw_metadata?: Record<string, unknown>;
}

const PIXEL_API_URL = process.env["PIX_API_URL"] ?? "http://localhost:8001";

export class GestaltClient {
  private readonly aiService: AIService | null;

  /**
   * @param aiService Optional AIService instance. When provided, the instance
   *   methods route through the app's AI layer (auth context, observability).
   *   When omitted, the static methods use direct fetch (legacy behaviour).
   */
  constructor(aiService?: AIService) {
    this.aiService = aiService ?? null;
  }

  /**
   * Fuse psychological signals via the Gestalt Engine API.
   */
  async analyzeGestalt(request: GestaltAnalysisRequest): Promise<GestaltAnalysisResponse> {
    if (this.aiService) {
      const result = await this.aiService.processText(JSON.stringify(request), {
        endpoint: "analyze/gestalt",
      });
      return result as GestaltAnalysisResponse;
    }

    return GestaltClient.analyzeGestaltStatic(request);
  }

  /**
   * Reset the Gestalt session through AIService if available.
   */
  async resetSession(): Promise<void> {
    if (this.aiService) {
      await this.aiService.processText(JSON.stringify({ action: "reset" }), {
        endpoint: "analyze/gestalt/reset",
      });
      return;
    }

    return GestaltClient.resetSessionStatic();
  }

  // ── Legacy static API (preserved for backward compatibility) ────────────

  /**
   * Fuse psychological signals via the Gestalt Engine API (direct fetch).
   */
  static async analyzeGestaltStatic(
    request: GestaltAnalysisRequest,
  ): Promise<GestaltAnalysisResponse> {
    try {
      const response = await fetch(`${PIXEL_API_URL}/analyze/gestalt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gestalt API error (${response.status}): ${errorText}`);
      }

      return (await response.json()) as GestaltAnalysisResponse;
    } catch (error: unknown) {
      logger.error("Failed to call Gestalt API", { error });
      throw error;
    }
  }

  /**
   * Reset the Gestalt session (direct fetch).
   */
  static async resetSessionStatic(): Promise<void> {
    try {
      const response = await fetch(`${PIXEL_API_URL}/analyze/gestalt/reset`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Gestalt reset failed: ${response.status}`);
      }
    } catch (error: unknown) {
      logger.error("Failed to reset Gestalt session", { error });
    }
  }

  // ── Static convenience wrappers (delegate to instance method) ──────────

  /**
   * Fuse psychological signals — convenience wrapper for default client.
   * Replaced by instance API; kept for callers that haven't migrated.
   */
  static async analyzeGestalt(request: GestaltAnalysisRequest): Promise<GestaltAnalysisResponse> {
    return new GestaltClient().analyzeGestalt(request);
  }

  /**
   * Reset session — convenience wrapper for default client.
   */
  static async resetSession(): Promise<void> {
    return new GestaltClient().resetSession();
  }
}
