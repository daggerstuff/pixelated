/**
 * LR schedule helpers distilled from Tinker docs.
 *
 * - Tinker Optimizers: https://tinker-docs.thinkingmachines.ai/tinker/optimizers/
 *   SFT guidance: linear decay to zero ≈ 1.3x more step-efficient than constant LR;
 *   schedule is user-managed per optim_step (we model it as FineTuningConfig.lrSchedule).
 * - Batch scaling: lr ∝ sqrt(batchSize) for SFT (fixed 102k-example study).
 */

import type { FineTuningConfig, LrSchedule, LrScheduleKind } from "./types";

export const DEFAULT_LR_SCHEDULE_KIND: LrScheduleKind = "constant";

/**
 * Effective multiplier for `learningRateMultiplier` at a given step.
 * Returns 1.0 for constant, linearly decaying 1→0, or cosine 1→0.
 * Warmup linearly ramps 0→1 over warmupSteps before the schedule.
 */
export function resolveLrMultiplier(
  schedule: LrSchedule | undefined,
  step: number,
  totalSteps: number,
): number {
  const kind = schedule?.kind ?? DEFAULT_LR_SCHEDULE_KIND;
  const warmupSteps = Math.max(0, schedule?.warmupSteps ?? 0);
  const decaySteps = Math.max(1, schedule?.decaySteps ?? totalSteps);

  if (warmupSteps > 0 && step < warmupSteps) {
    return (step + 1) / warmupSteps;
  }

  const decayStep = Math.max(0, step - warmupSteps);
  const decayTotal = Math.max(1, decaySteps - warmupSteps);

  if (kind === "constant") return 1;

  const progress = Math.min(1, decayStep / decayTotal);

  if (kind === "linear-decay-to-zero") {
    return Math.max(0, 1 - progress);
  }

  // cosine: 0.5 * (1 + cos(pi * progress)), 1→0
  return 0.5 * (1 + Math.cos(Math.PI * progress));
}

/**
 * Returns the absolute LR for a given step when a schedule is configured.
 * Falls back to baseLr when schedule is constant/undefined.
 */
export function resolveLrForStep(
  baseLr: number,
  schedule: LrSchedule | undefined,
  step: number,
  totalSteps: number,
): number {
  return baseLr * resolveLrMultiplier(schedule, step, totalSteps);
}

/**
 * Tinker SFT batch-size scaling: lr ∝ sqrt(batchSize).
 * Quadrupling batch → doubling LR. For RL, pass numProblems as batch sizes.
 */
export function scaleLrForBatchSize(
  baseLr: number,
  baseBatchSize: number,
  newBatchSize: number,
): number {
  if (baseBatchSize <= 0 || newBatchSize <= 0) return baseLr;
  return baseLr * Math.sqrt(newBatchSize / baseBatchSize);
}

/**
 * Convenience: compute scaled LR directly from a FineTuningConfig that carries
 * both batchSize and baselineBatchSize. Returns null when scaling is not applicable.
 */
export function scaledLrHint(config: FineTuningConfig): number | null {
  const baseLr = config.learningRateMultiplier;
  const baseBatch = config.baselineBatchSize;
  const newBatch = config.batchSize;
  if (baseLr === undefined || baseBatch === undefined || newBatch === undefined) return null;
  if (baseBatch === newBatch) return null;
  return scaleLrForBatchSize(baseLr, baseBatch, newBatch);
}

export function normalizeLrSchedule(
  schedule: LrSchedule | undefined,
  nEpochs: number,
): LrSchedule {
  if (!schedule) return { kind: "constant" };
  const decaySteps = schedule.decaySteps ?? Math.max(1, nEpochs * 100);
  return { ...schedule, decaySteps };
}
