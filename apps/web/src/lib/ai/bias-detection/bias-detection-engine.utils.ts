/**
 * Bias detection engine utilities — thresholds, helpers, and fallback layers.
 * Extracted from BiasDetectionEngine.ts.
 */

import { createBuildSafeLogger } from "../../logging/build-safe-logger";
import type {
  AlertLevel,
  AnalysisResult,
  BiasDetectionConfig,
  BiasLayerWeights,
  BiasThresholdsConfig,
  EvaluationAnalysisResult,
  InteractiveAnalysisResult,
  ModelLevelAnalysisResult,
  PreprocessingAnalysisResult,
  TherapeuticSession as SessionData,
  UserContext,
} from "./types";

export const biasLogger = createBuildSafeLogger("bias-detection");

export const logger = createBuildSafeLogger("BiasDetectionEngine");

export type LayerResults = import("./types").LayerResults;

export const DEFAULT_THRESHOLDS: BiasThresholdsConfig = {
  warning: 0.3,
  high: 0.6,
  critical: 0.8,
};

export const DEFAULT_WEIGHTS: BiasLayerWeights = {
  preprocessing: 0.25,
  modelLevel: 0.25,
  interactive: 0.25,
  evaluation: 0.25,
};

export function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function toNumberValue(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

export function toStringArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.every((item): item is string => typeof item === "string") ? value : [];
}

export type DemographicsSnapshot = {
  age: string;
  gender: string;
  ethnicity: string;
  primaryLanguage: string;
};

export function toDemographics(demographics: Record<string, unknown> | undefined): DemographicsSnapshot {
  return {
    age: toStringValue(demographics?.["age"]),
    gender: toStringValue(demographics?.["gender"]),
    ethnicity: toStringValue(demographics?.["ethnicity"]),
    primaryLanguage: toStringValue(demographics?.["primaryLanguage"]),
  };
}

export function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function toAlertLevel(value: string): AlertLevel {
  if (value === "low" || value === "medium" || value === "high" || value === "critical") {
    return value;
  }
  return "low";
}

export function isSessionData(value: unknown): value is SessionData {
  return (
    isRecordValue(value) && typeof value["sessionId"] === "string" && value["sessionId"] !== ""
  );
}

export function validateWeights(w: BiasLayerWeights): void {
  const sum = w["preprocessing"] + w["modelLevel"] + w["interactive"] + w["evaluation"];
  if (Math.abs(sum - 1) > 1e-6) {
    throw new Error("Layer weights must sum to 1.0");
  }
}


export function fallbackLayer(): { biasScore: number; confidence: number } {

  return { biasScore: 0.5, confidence: 0.4 };

}

export function getPreprocessingFallback(): PreprocessingAnalysisResult {

  const fb = fallbackLayer();

  return {

    biasScore: fb.biasScore,

    linguisticBias: {

      genderBiasScore: 0,

      racialBiasScore: 0,

      ageBiasScore: 0,

      culturalBiasScore: 0,

      biasedTerms: [],

      sentimentAnalysis: {

        overallSentiment: 0,

        emotionalValence: 0,

        subjectivity: 0,

        demographicVariations: {},

      },

    },

    representationAnalysis: {

      demographicDistribution: {},

      underrepresentedGroups: [],

      overrepresentedGroups: [],

      diversityIndex: 0,

      intersectionalityAnalysis: [],

    },

    dataQualityMetrics: {

      completeness: 1,

      consistency: 1,

      accuracy: 1,

      timeliness: 1,

      validity: 1,

      missingDataByDemographic: {},

    },

    recommendations: [],

  };

}



/**

 * Returns fallback result for model-level analysis.

 */

export function getModelLevelFallback(): ModelLevelAnalysisResult {

  const fb = fallbackLayer();

  return {

    biasScore: fb.biasScore,

    fairnessMetrics: {

      demographicParity: 0,

      equalizedOdds: 0,

      equalOpportunity: 0,

      calibration: 0,

      individualFairness: 0,

      counterfactualFairness: 0,

    },

    performanceMetrics: {

      accuracy: 0,

      precision: 0,

      recall: 0,

      f1Score: 0,

      auc: 0,

      calibrationError: 0,

      demographicBreakdown: {},

    },

    groupPerformanceComparison: [],

    recommendations: [],

  };

}



/**

 * Returns fallback result for interactive analysis.

 */

export function getInteractiveFallback(): InteractiveAnalysisResult {

  const fb = fallbackLayer();

  return {

    biasScore: fb.biasScore,

    counterfactualAnalysis: {

      scenariosAnalyzed: 0,

      biasDetected: false,

      consistencyScore: 0,

      problematicScenarios: [],

    },

    featureImportance: [],

    whatIfScenarios: [],

    recommendations: [],

  };

}



/**

 * Returns fallback result for evaluation analysis.

 */

export function getEvaluationFallback(): EvaluationAnalysisResult {

  const fb = fallbackLayer();

  return {

    biasScore: fb.biasScore,

    huggingFaceMetrics: {

      toxicity: 0.05,

      bias: 0.15,

      regard: {},

      stereotype: 0.1,

      fairness: 0.85,

    },

    customMetrics: {

      therapeuticBias: 0.1,

      culturalSensitivity: 0.1,

      professionalEthics: 0.1,

      patientSafety: 0.1,

    },

    temporalAnalysis: {

      trendDirection: "stable",

      changeRate: 0,

      seasonalPatterns: [],

      interventionEffectiveness: [],

    },

    recommendations: [],

  };

}
