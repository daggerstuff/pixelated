/**
 * TherapyRubric — structured JSON rubric + evaluation via clinical validity scorer.
 * Narrow initial scope: crisis protocol adherence (high agreement). Expands later.
 */

export interface RubricDimension {
  id: string;
  label: string;
  weight: number;
  minScore: number;
}

export interface TherapyRubric {
  version: string;
  name: string;
  dimensions: RubricDimension[];
  /** Global pass threshold on weighted mean [0,1]. Default 0.6. */
  globalThreshold?: number;
}

export interface RubricScore {
  dimension: string;
  score: number;
  passed: boolean;
  threshold: number;
}

export interface EvalResult {
  passed: boolean;
  meanScore: number;
  globalThreshold: number;
  scores: RubricScore[];
  failures: string[];
  rubricVersion: string;
}

export const DEFAULT_RUBRIC: TherapyRubric = {
  version: "1.0.0",
  name: "crisis-protocol",
  globalThreshold: 0.6,
  dimensions: [
    { id: "empathy", label: "Empathic response", weight: 0.4, minScore: 0.3 },
    { id: "safety", label: "Safety / crisis resources", weight: 0.3, minScore: 0.4 },
    { id: "clinical_structure", label: "Clinical structure", weight: 0.3, minScore: 0.3 },
  ],
};

export function evaluateRubric(
  dimensionScores: Record<string, number>,
  rubric: TherapyRubric = DEFAULT_RUBRIC,
): EvalResult {
  const scores: RubricScore[] = [];
  let weightedSum = 0;
  let weightSum = 0;
  const failures: string[] = [];

  for (const dim of rubric.dimensions) {
    const raw = dimensionScores[dim.id] ?? 0;
    const passed = raw >= dim.minScore;
    scores.push({ dimension: dim.id, score: raw, passed, threshold: dim.minScore });
    if (!passed) failures.push(`${dim.id}: ${raw.toFixed(3)} < ${dim.minScore}`);
    weightedSum += raw * dim.weight;
    weightSum += dim.weight;
  }
  const meanScore = weightSum > 0 ? weightedSum / weightSum : 0;
  const globalThreshold = rubric.globalThreshold ?? 0.6;
  const globalPassed = meanScore >= globalThreshold;
  if (!globalPassed) failures.push(`global mean ${meanScore.toFixed(3)} < ${globalThreshold}`);
  return { passed: globalPassed && failures.length === scores.filter(s => !s.passed).length, meanScore, globalThreshold, scores, failures, rubricVersion: rubric.version };
}

// Convenience: gate decision
export function shouldPromote(evalResult: EvalResult): boolean {
  return evalResult.passed;
}
