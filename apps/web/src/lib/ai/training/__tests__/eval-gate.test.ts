import { describe, it, expect } from "vitest";
import { evaluateRubric, DEFAULT_RUBRIC, shouldPromote } from "../eval/TherapyRubric";
import { EvalGate } from "../eval/EvalGate";

describe("TherapyRubric", () => {
  it("passes when all dimensions above threshold", () => {
    const r = evaluateRubric({ empathy: 0.8, safety: 0.9, clinical_structure: 0.7 });
    expect(r.passed).toBe(true);
    expect(r.failures).toHaveLength(0);
  });
  it("fails when a dimension below threshold", () => {
    const r = evaluateRubric({ empathy: 0.2, safety: 0.9, clinical_structure: 0.7 });
    expect(r.passed).toBe(false);
    expect(r.failures.length).toBeGreaterThan(0);
  });
  it("fails when global mean below threshold even if dims pass", () => {
    const r = evaluateRubric({ empathy: 0.35, safety: 0.45, clinical_structure: 0.35 }, { ...DEFAULT_RUBRIC, globalThreshold: 0.8 });
    expect(r.passed).toBe(false);
  });
  it("shouldPromote delegates to passed", () => {
    const ok = evaluateRubric({ empathy: 0.8, safety: 0.8, clinical_structure: 0.8 });
    const bad = evaluateRubric({ empathy: 0.1, safety: 0.1, clinical_structure: 0.1 });
    expect(shouldPromote(ok)).toBe(true);
    expect(shouldPromote(bad)).toBe(false);
  });
});

describe("EvalGate", () => {
  it("evaluates via rubric", () => {
    const gate = new EvalGate();
    expect(gate.evaluate({ empathy: 0.9, safety: 0.9, clinical_structure: 0.9 }).passed).toBe(true);
    expect(gate.evaluate({ empathy: 0.0, safety: 0.0, clinical_structure: 0.0 }).passed).toBe(false);
  });
  it("getRubric returns copy", () => {
    const gate = new EvalGate();
    const a = gate.getRubric();
    const b = gate.getRubric();
    expect(a).not.toBe(b);
    expect(a.dimensions).not.toBe(b.dimensions);
  });
});
