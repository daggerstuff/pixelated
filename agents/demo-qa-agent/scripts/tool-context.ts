/**
 * Minimal {@link ToolContext} stub for headless tool invocation.
 *
 * The demo-qa-agent tools (`audit_corpus`, `curate_showcase`,
 * `gate_injection`) never read the runtime context — they are pure
 * deterministic functions over file inputs. When we drive them directly
 * from `scripts/batch-audit.ts` or the vitest suite (no Eve server),
 * we still have to satisfy `defineTool`'s `(input, ctx: ToolContext)`
 * call signature. This stub provides a structurally-valid context whose
 * accessors throw on use, so any accidental context dependency fails
 * loudly instead of silently returning garbage.
 */

import type { ToolContext } from "eve/tools";

const NOOP_PARENT = undefined;

export const noopToolContext: ToolContext = {
  session: {
    id: "headless-batch",
    auth: {} as ToolContext["session"]["auth"],
    turn: {} as ToolContext["session"]["turn"],
    parent: NOOP_PARENT,
  },
  getSandbox: async () => {
    throw new Error("noopToolContext.getSandbox called in headless mode");
  },
  getSkill: () => {
    throw new Error("noopToolContext.getSkill called in headless mode");
  },
  getToken: async () => {
    throw new Error("noopToolContext.getToken called in headless mode");
  },
  requireAuth: () => {
    throw new Error("noopToolContext.requireAuth called in headless mode");
  },
};
