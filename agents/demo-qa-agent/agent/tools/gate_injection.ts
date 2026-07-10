import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

/**
 * Injection safety controller for the demo corpus.
 *
 * Mirrors pipeline-agent's human-in-the-loop gate: destructive live-push
 * actions (push_to_gmail.py / push_to_chat.py in the hackathon workspace)
 * MUST NOT run unless (1) the last audit_corpus run passed with zero
 * blocking findings, and (2) a human approves this gate.
 *
 * The tool does NOT execute the push scripts itself — it only returns an
 * authorization verdict the orchestrator acts on. This keeps the destructive
 * blast radius inside an explicit approval boundary.
 */

interface GateInput {
  last_audit_pass: boolean;
  last_audit_blocking_count: number;
  target: "gmail" | "chat" | "both";
  dry_run?: boolean;
}

const SCHEMA = z.object({
  last_audit_pass: z
    .boolean()
    .describe("Whether the most recent audit_corpus run passed (zero blocking findings)."),
  last_audit_blocking_count: z
    .number()
    .int()
    .min(0)
    .describe("Blocking finding count from the most recent audit_corpus run."),
  target: z
    .enum(["gmail", "chat", "both"])
    .describe("Which destructive push the gate is authorizing."),
  dry_run: z
    .boolean()
    .optional()
    .default(true)
    .describe("If true, only return a verdict; never mark as authorized-to-push."),
});

export default defineTool({
  description:
    "Injection safety gate for the demo corpus. Blocks destructive " +
    "push_to_gmail.py / push_to_chat.py unless the last corpus audit passed " +
    "with zero blocking findings AND a human approves. Behind always() " +
    "approval because a cleared gate lets live scripts write ~830 messages " +
    "into a real Gmail / Google Chat workspace.",
  inputSchema: SCHEMA,
  approval: always<GateInput>(),
  async execute(input: GateInput) {
    const auditCleared = input.last_audit_pass && input.last_audit_blocking_count === 0;

    if (!auditCleared) {
      return {
        authorized: false,
        target: input.target,
        reason:
          "Audit not cleared: " +
          `${input.last_audit_blocking_count} blocking finding(s). ` +
          "Fix the corpus and re-run audit_corpus before requesting injection.",
        required_before_push: ["audit_corpus pass (zero blocking)", "human approval of this gate"],
        state: "BLOCKED",
        evaluated_at: new Date().toISOString(),
      };
    }

    // Audit cleared. dry_run never authorizes a live push; a real push
    // still requires the human to approve the always() gate.
    const authorized = input.dry_run === false;

    return {
      authorized,
      target: input.target,
      reason: authorized
        ? "Audit cleared and human approved — safe to run the push script."
        : "Audit cleared. Awaiting human approval of this gate to authorize push.",
      required_before_push: ["human approval of this gate"],
      state: authorized ? "AUTHORIZED" : "AWAITING_APPROVAL",
      evaluated_at: new Date().toISOString(),
    };
  },
});
