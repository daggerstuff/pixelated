import { defineTool } from 'eve/tools'
import { always } from 'eve/tools/approval'
import { z } from 'zod'

/**
 * Content publishing safety controller for the scenario library.
 *
 * Mirrors pipeline-agent's human-in-the-loop gate: destructive publishing
 * actions (adding scenarios to the library) MUST NOT run unless (1) the last
 * audit_corpus run passed with zero blocking findings, and (2) a human
 * approves this gate.
 *
 * The tool does NOT execute the publish action itself — it only returns an
 * authorization verdict the orchestrator acts on. This keeps the destructive
 * blast radius inside an explicit approval boundary.
 */

interface GateInput {
  last_audit_pass: boolean
  last_audit_blocking_count: number
  scenario_ids?: string[]
  dry_run?: boolean
}

const SCHEMA = z.object({
  last_audit_pass: z
    .boolean()
    .describe(
      'Whether the most recent audit_corpus run passed (zero blocking findings).',
    ),
  last_audit_blocking_count: z
    .number()
    .int()
    .min(0)
    .describe('Blocking finding count from the most recent audit_corpus run.'),
  scenario_ids: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Scenario IDs requesting publishing to the library.'),
  dry_run: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'If true, only return a verdict; never mark as authorized-to-publish.',
    ),
})

export default defineTool({
  description:
    'Content publishing safety gate for the scenario library. Blocks ' +
    'scenario publishing unless the last audit passed with zero blocking ' +
    'findings AND a human approves. Behind always() approval because a ' +
    'cleared gate adds scenarios to the live training library.',
  inputSchema: SCHEMA,
  approval: always<GateInput>(),
  async execute(input: GateInput) {
    const auditCleared =
      input.last_audit_pass && input.last_audit_blocking_count === 0
    const scenarioCount = input.scenario_ids?.length ?? 0

    if (!auditCleared) {
      return {
        authorized: false,
        scenario_count: scenarioCount,
        reason:
          'Audit not cleared: ' +
          `${input.last_audit_blocking_count} blocking finding(s). ` +
          'Fix the scenarios and re-run audit_corpus before requesting publishing.',
        required_before_publish: [
          'audit_corpus pass (zero blocking)',
          'human approval of this gate',
        ],
        state: 'BLOCKED',
        evaluated_at: new Date().toISOString(),
      }
    }

    // Audit cleared. dry_run never authorizes a live publish; a real publish
    // still requires the human to approve the always() gate.
    const authorized = input.dry_run === false

    return {
      authorized,
      scenario_count: scenarioCount,
      reason: authorized
        ? 'Audit cleared and human approved — safe to publish scenarios to the library.'
        : 'Audit cleared. Awaiting human approval of this gate to authorize publishing.',
      required_before_publish: ['human approval of this gate'],
      state: authorized ? 'AUTHORIZED' : 'AWAITING_APPROVAL',
      evaluated_at: new Date().toISOString(),
    }
  },
})
