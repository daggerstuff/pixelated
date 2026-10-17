import type { EvalResult, TherapyRubric } from "./TherapyRubric";
import { evaluateRubric, DEFAULT_RUBRIC } from "./TherapyRubric";

export interface GateResult {
  passed: boolean;
  result: EvalResult;
}

export class EvalGate {
  constructor(private readonly rubric: TherapyRubric = DEFAULT_RUBRIC) {}

  evaluate(dimensionScores: Record<string, number>): GateResult {
    const result = evaluateRubric(dimensionScores, this.rubric);
    return { passed: result.passed, result };
  }

  getRubric(): TherapyRubric {
    return { ...this.rubric, dimensions: [...this.rubric.dimensions] };
  }
}
