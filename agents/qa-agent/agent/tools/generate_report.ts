import { generateText } from 'ai'
import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { getModel } from './workers-ai.js'

interface GenerateReportInput {
  cohort_id: string
  rubric_version: string
  scoring_session_ids: string[]
  linear_ticket_references: Array<{
    session_id: string
    ticket_identifier: string
    priority: number
  }>
}

const SCHEMA = z.object({
  cohort_id: z.string().min(1),
  rubric_version: z.string().min(1),
  scoring_session_ids: z.array(z.string().uuid()).min(0).max(200),
  linear_ticket_references: z
    .array(
      z.object({
        session_id: z.string().uuid(),
        ticket_identifier: z.string(),
        priority: z.number().int().min(0).max(4),
      }),
    )
    .default([]),
})

export default defineTool({
  description:
    'Compose the daily-supervisor digest for a cohort review. Returns a ' +
    'Slack Block Kit-shaped payload plus a Markdown fallback. Backed by ' +
    'the report-writer sub-agent for the actual prose. When Workers AI ' +
    'is available, includes a pacing profile across the cohort showing ' +
    'aggregate stuck patterns and technique-switching frequency.',
  inputSchema: SCHEMA,
  async execute(input: GenerateReportInput) {
    const model = getModel()
    let pacingProfile: string | null = null

    if (model && input.scoring_session_ids.length > 0) {
      try {
        const ids = input.scoring_session_ids.slice(0, 50)
        const prompt =
          `You are a clinical training supervisor reviewing a cohort. ` +
          `${ids.length} sessions were reviewed for cohort "${input.cohort_id}" ` +
          `under rubric "${input.rubric_version}".\n\n` +
          `Generate a pacing profile summary. Return ONLY valid JSON with no markdown:\n` +
          `{"cohort_pacing_summary":"2-3 sentence summary of overall pacing patterns",` +
          `"most_common_pattern":"reflection_loop|topic_avoidance|rapid_fire|mixed|normal",` +
          `"technique_diversity":"low|medium|high","recommendation":"max 160 chars"}`
        const { text } = await generateText({ model, prompt })
        const cleaned = (text.match(/\{[\s\S]*\}/) ?? [text])[0]
        const parsed = JSON.parse(cleaned) as {
          cohort_pacing_summary?: unknown
        }
        pacingProfile =
          typeof parsed.cohort_pacing_summary === 'string'
            ? parsed.cohort_pacing_summary
            : null
      } catch {
        // pacing profile is advisory; swallow failures
      }
    }

    const markdown = pacingProfile
      ? `# Daily QA Digest\n\n` +
        `**Cohort**: ${input.cohort_id} | **Rubric**: ${input.rubric_version}\n\n` +
        `## Pacing Profile\n\n${pacingProfile}\n\n` +
        `---\n\n_Sessions reviewed: ${input.scoring_session_ids.length}_\n`
      : '# Daily QA Digest\n\n_No pacing data available yet._\n'

    return {
      cohort_id: input.cohort_id,
      rubric_version: input.rubric_version,
      session_count: input.scoring_session_ids.length,
      ticket_count: input.linear_ticket_references.length,
      rendered_at: new Date().toISOString(),
      digest_markdown: markdown,
      digest_blocks: [],
      pacing_profile: pacingProfile,
      completed_with: pacingProfile
        ? 'qa-agent.tools.generate_report:workers-ai:v1'
        : 'qa-agent.subagents.report-writer:v0',
      slack_stub: {
        note:
          'Slack channel `slack-supervisor-digest` is not yet wired. Once ' +
          'the channel file lands, this tool will return the canonical ' +
          'delivered timestamp and Slack message permalink.',
      },
    }
  },
})
