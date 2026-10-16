/**
 * LoRA helpers distilled from Tinker LoRA Primer:
 * https://tinker-docs.thinkingmachines.ai/tinker/lora-primer/
 *
 * - Default rank 32. RL: keep small; large SL: increase until loraParams ≥ completion tokens.
 * - 10x LR multiplier over full fine-tuning; optimal LR is rank-invariant.
 * - Apply to all matrices (MLP/MoE included), not attention-only.
 * - Large batches degrade LoRA efficiency; rank increase won't compensate.
 * - Dimuon SFT ≈ 15x AdamW LR, RL ≈ 60x.
 */

import type { LoraTarget } from "./types";

export const TINKER_DEFAULT_LORA_RANK = 32;
export const TINKER_LORA_LR_MULTIPLIER = 10;
export const DIMUON_SFT_LR_FACTOR = 15;
export const DIMUON_RL_LR_FACTOR = 60;

/**
 * Rough trainable-param estimate for LoRA.
 * Uses Tinker's get_lora_param_count as reference: for rank r, each adapted
 * weight W (m×n) contributes r*(m+n) params. We approximate via model size.
 */
export function estimateLoraParams(
  modelParamCount: number,
  rank: number,
  target: LoraTarget = "all",
): number {
  if (modelParamCount <= 0 || rank <= 0) return 0;
  const targetFactor = target === "all" ? 1 : 0.35;
  return Math.floor(modelParamCount * 0.015 * (rank / 32) * targetFactor);
}

export function getLoraCapacityWarning(
  completionTokens: number,
  loraParams: number,
): string | null {
  if (completionTokens <= 0 || loraParams <= 0) return null;
  if (completionTokens <= loraParams) return null;
  return (
    `LoRA capacity: completion tokens (~${completionTokens}) exceed trainable LoRA params (~${loraParams}). ` +
    `Tinker guidance: loraParams should ≥ completion tokens for large SFT. Consider increasing loraRank.`
  );
}

export function getDimuonLrHint(
  adamwLr: number,
  phase: "sft" | "rl" = "sft",
): number {
  const factor = phase === "rl" ? DIMUON_RL_LR_FACTOR : DIMUON_SFT_LR_FACTOR;
  return adamwLr * factor;
}

export function validateLoraConfig(
  rank: number | undefined,
  target: LoraTarget | undefined,
): string[] {
  const warnings: string[] = [];
  if (rank !== undefined && (!Number.isFinite(rank) || rank <= 0)) {
    warnings.push(`loraRank must be a positive integer, got ${String(rank)}`);
  }
  if (target === "attention-only") {
    warnings.push(
      "loraTarget 'attention-only' underperforms even rank-compensated per Tinker LoRA Primer; prefer 'all'.",
    );
  }
  return warnings;
}
