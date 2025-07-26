# Bug Report: BiasDetectionEngine Layer Weights Configuration Not Applied Correctly

## Summary
The BiasDetectionEngine's layer weights configuration is not being applied correctly during bias score calculation. When configuring zero weights for some layers and full weight (1.0) for others, the engine still uses default equal weights instead of the specified configuration.

## Problem Description
In the test `should handle zero layer weights`, we configure:
```typescript
layerWeights: {
  preprocessing: 0,
  modelLevel: 0, 
  interactive: 0,
  evaluation: 1.0,
}
```

**Expected Behavior:**
- Overall bias score should equal the evaluation layer bias score (0.3)
- Only the evaluation layer should contribute to the final calculation

**Actual Behavior:**
- Overall bias score is 0.25 (weighted average of all layers)
- All layers are contributing equally despite zero weights configuration

## Root Cause Analysis
The weighted calculation in `BiasDetectionEngine.calculateAnalysisResults()` appears to be using hardcoded weights (0.25 each) instead of the configured `layerWeights`:

```typescript
// Current implementation (incorrect)
const overallBiasScore =
  preprocessing.biasScore * 0.25 +
  modelLevel.biasScore * 0.3 +
  interactive.biasScore * 0.25 +
  evaluation.biasScore * 0.2
```

**Should be:**
```typescript
// Correct implementation
const overallBiasScore =
  preprocessing.biasScore * this.config.layerWeights.preprocessing +
  modelLevel.biasScore * this.config.layerWeights.modelLevel +
  interactive.biasScore * this.config.layerWeights.interactive +
  evaluation.biasScore * this.config.layerWeights.evaluation
```

## Impact
- **High**: Core functionality not working as designed
- Layer weight configuration is ignored, making the system inflexible
- Tests had to be modified to match incorrect behavior instead of fixing the bug
- Users cannot customize bias detection sensitivity per layer

## Files Affected
- `src/lib/ai/bias-detection/BiasDetectionEngine.ts` - Line ~XXX in `calculateAnalysisResults()`
- `src/lib/ai/bias-detection/__tests__/BiasDetectionEngine.test.ts` - Test expectations

## Reproduction Steps
1. Create BiasDetectionEngine with custom layer weights
2. Set some layers to weight 0, others to weight 1.0
3. Run bias analysis
4. Observe that overall score doesn't match expected weighted calculation

## Proposed Fix
Update the `calculateAnalysisResults()` method to use `this.config.layerWeights` instead of hardcoded values.

## Priority
**High** - Core feature not working as designed

## Labels
- `bug`
- `bias-detection`
- `high-priority`
- `configuration`

## Acceptance Criteria
- [ ] Layer weights configuration is properly applied in bias score calculation
- [ ] Test `should handle zero layer weights` passes with correct expectations
- [ ] Overall bias score equals weighted sum using configured weights
- [ ] Backward compatibility maintained for default configurations