import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { defineTool } from 'eve/tools'
import { always } from 'eve/tools/approval'
import { z } from 'zod'

import { storeMemory } from '../foresight-client.js'
import { checkEvalGate } from '../lib/training-infra-client.js'

/**
 * Evaluate the current pipeline worktree state through the advisor-agent.
 *
 * Collects git diff, git status, and changed source files, then returns
 * a structured review payload. The orchestrator should pass this payload
 * to the advisor-agent via the subagent tool for a full critique.
 *
 * The gate also consumes the training-infra MCP eval results (P3.2): when an
 * `eval_tag` is supplied, `eval_gate` decides whether the eval deltas pass,
 * and the verdict is surfaced as `eval_gate`. The gate MUST block promotion
 * when either the advisor finds issues scoring >= 80 or `eval_gate.passed`
 * is false.
 */

interface EvaluatePipelineReviewInput {
  gate_name: string
  stage: string
  training_job_id?: string
  eval_tag?: string
  min_eval_delta?: number
  min_pass_rate?: number
}

export default defineTool({
  description:
    'Evaluate the current pipeline worktree through the advisor-agent ' +
    'before a promotion gate. Collects git diff, status, and changed ' +
    'source files and, when eval_tag is given, consults the training-infra ' +
    'MCP eval_gate for the eval deltas. Returns a structured review payload ' +
    'for the orchestrator to forward to the advisor-agent subagent. If the ' +
    'advisor returns issues scoring >= 80, or eval_gate.passed is false, ' +
    'this gate MUST block promotion.',
  inputSchema: z.object({
    gate_name: z
      .string()
      .min(1)
      .describe('Gate identifier (e.g. Gate 3, Gate 4).'),
    stage: z
      .string()
      .min(1)
      .describe('Current pipeline stage (e.g. staging, production).'),
    training_job_id: z
      .string()
      .optional()
      .describe('Training job ID for provenance.'),
    eval_tag: z
      .string()
      .optional()
      .describe(
        'Eval results tag under evals/ in the training bucket. When set, the ' +
          'gate consumes eval_gate for it.',
      ),
    min_eval_delta: z
      .number()
      .optional()
      .describe('Minimum sft-minus-base pass-rate delta required.'),
    min_pass_rate: z
      .number()
      .optional()
      .describe('Minimum absolute sft-arm pass rate required.'),
  }),
  approval: always<EvaluatePipelineReviewInput>(),
  async execute(input: EvaluatePipelineReviewInput) {
    const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..')
    const evaluatedAt = new Date().toISOString()

    // --- Capture git state ---
    let gitDiff = ''
    let gitStatus = ''
    let commitHash = ''
    let branch = ''

    try {
      gitDiff = execSync('git diff --unified=5', {
        cwd: workspaceRoot,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      })
    } catch {
      /* no diff yet */
    }

    try {
      gitStatus = execSync('git status --short', {
        cwd: workspaceRoot,
        encoding: 'utf8',
      }).trim()
    } catch {
      /* not a git repo */
    }

    try {
      commitHash = execSync('git rev-parse --short HEAD', {
        cwd: workspaceRoot,
        encoding: 'utf8',
      }).trim()
    } catch {
      /* ignore */
    }

    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: workspaceRoot,
        encoding: 'utf8',
      }).trim()
    } catch {
      /* ignore */
    }

    // --- Collect changed source files ---
    const changedFiles: string[] = []
    for (const line of gitStatus.split('\n')) {
      const file = line.slice(3).trim()
      if (file && !file.startsWith('node_modules/')) {
        changedFiles.push(file)
      }
    }

    // --- Read content of changed files (up to 10, capped at 30KB each) ---
    const fileContents: Array<{ path: string; content: string }> = []
    for (const fp of changedFiles.slice(0, 10)) {
      const fullPath = resolve(workspaceRoot, fp)
      try {
        const content = readFileSync(fullPath, { encoding: 'utf8' })
        fileContents.push({
          path: fp,
          content:
            content.length > 30_000
              ? content.slice(0, 30_000) + '\n// ... truncated ...'
              : content,
        })
      } catch {
        /* file may have been deleted */
      }
    }

    // --- Consume eval results through the training-infra MCP gate (P3.2) ---
    const evalGate = input.eval_tag
      ? await checkEvalGate({
          tag: input.eval_tag,
          min_delta: input.min_eval_delta,
          min_pass_rate: input.min_pass_rate,
        })
      : null
    const evalGatePassed = evalGate ? evalGate.passed === true : null

    // --- Build review payload ---
    const reviewPayload = {
      type: 'pipeline_review_request',
      gate_name: input.gate_name,
      stage: input.stage,
      training_job_id: input.training_job_id ?? null,
      evaluated_at: evaluatedAt,
      git: {
        branch,
        commit_hash: commitHash,
        status: gitStatus,
      },
      diff_preview:
        gitDiff.length > 50_000
          ? gitDiff.slice(0, 50_000) + '\n# ... diff truncated (50KB limit) ...'
          : gitDiff,
      changed_files: fileContents,
    }

    // --- Persist review request to Foresight for audit ---
    const stored = await storeMemory({
      content: JSON.stringify(reviewPayload),
      category: 'pipeline_review',
      scope: 'project',
      retention: 'long_term',
      importance: 0.8,
      tags: [
        'pipeline_review',
        `gate:${input.gate_name}`,
        `stage:${input.stage}`,
        ...(input.training_job_id
          ? [`training_job:${input.training_job_id}`]
          : []),
      ],
    })

    return {
      gate_name: input.gate_name,
      stage: input.stage,
      evaluated_at: evaluatedAt,
      review_payload: {
        summary: {
          branch,
          commit_hash: commitHash,
          changed_files_count: changedFiles.length,
          diff_size_bytes: gitDiff.length,
        },
        // The review_payload is what the orchestrator forwards to
        // the advisor-agent subagent for critique.
        review_context: {
          git_diff: gitDiff.length > 0,
          git_status: gitStatus,
          changed_files: fileContents.map((f) => f.path),
        },
      },
      eval_gate: input.eval_tag
        ? {
            tag: input.eval_tag,
            passed: evalGatePassed,
            reasons: evalGate?.reasons ?? [
              'eval_gate unavailable (training-infra MCP unreachable or gate error)',
            ],
            min_delta: evalGate?.min_delta ?? input.min_eval_delta ?? null,
            min_pass_rate:
              evalGate?.min_pass_rate ?? input.min_pass_rate ?? null,
          }
        : null,
      gate_blocked_by: [
        ...(input.eval_tag && evalGatePassed !== true ? ['eval_gate'] : []),
        'advisor_review_pending',
      ],
      advisor_review_required: true,
      instruction:
        'Forward the review_payload to the advisor-agent via subagent tool. ' +
        'If advisor-agent returns issues scoring >= 80, or eval_gate.passed ' +
        'is false, block this gate.',
      foresight_memory: stored ?? {
        memory_id: null,
        note: 'Foresight MCP write may have failed.',
      },
    }
  },
})
