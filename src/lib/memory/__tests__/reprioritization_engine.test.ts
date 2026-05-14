// ReprioritizationEngine test (TypeScript)import { ReprioritizationEngine, EvidenceItem } from '../reprioritization_engine';
import { describe, it, expect } from 'vitest';

describe('ReprioritizationEngine TS', () => {
  it('reorders tasks based on evidence scores', () => {
    const engine = new ReprioritizationEngine(['task_a', 'task_b', 'task_c']);
    const evidence: EvidenceItem[] = [
      { sourceId: 'eval1', evidenceType: 'gap', score: 2.5, details: { task_id: 'task_c' } },
      { sourceId: 'eval2', evidenceType: 'issue', score: 1.0, details: { task_id: 'task_a' } },
    ];
    const newOrder = engine.computeNewOrder(evidence);
    expect(newOrder).toEqual(['task_c', 'task_a', 'task_b']);
  });

  it('preserves base order with no evidence', () => {
    const engine = new ReprioritizationEngine(['t1', 't2']);
    const newOrder = engine.computeNewOrder([]);
    expect(newOrder).toEqual(['t1', 't2']);
  });
});\nimport { ReprioritizationEngine, EvidenceItem } from '../reprioritization_engine';\n\ndescribe('ReprioritizationEngine TS', () => {
  it('reorders tasks based on evidence scores', () => {
    const engine = new ReprioritizationEngine(['task_a', 'task_b', 'task_c']);
    const evidence: EvidenceItem[] = [
      { sourceId: 'eval1', evidenceType: 'gap', score: 2.5, details: { task_id: 'task_c' } },
      { sourceId: 'eval2', evidenceType: 'issue', score: 1.0, details: { task_id: 'task_a' } },
    ];
    const newOrder = engine.computeNewOrder(evidence);
    expect(newOrder).toEqual(['task_c', 'task_a', 'task_b']);
  });

  it('preserves base order with no evidence', () => {
    const engine = new ReprioritizationEngine(['t1', 't2']);
    const newOrder = engine.computeNewOrder([]);
    expect(newOrder).toEqual(['t1', 't2']);
  });
});