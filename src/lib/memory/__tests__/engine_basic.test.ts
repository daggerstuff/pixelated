// Simple sanity test for ReprioritizationEngine
import { ReprioritizationEngine } from '../reprioritization_engine';

test('engine creates instance', () => {
  const eng = new ReprioritizationEngine(['a','b']);
  expect(eng.computeNewOrder([])).toEqual(['a','b']);
});
