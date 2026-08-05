import { defineTool } from 'eve/tools'
import { z } from 'zod'

const SCHEMA = z.object({
  channel: z
    .string()
    .min(1)
    .describe('Slack channel name (e.g. #supervisor, #pixelated-mlops).'),
  message: z
    .string()
    .min(1)
    .max(4000)
    .describe('Message text to post. Supports markdown-like formatting.'),
  thread_ts: z
    .string()
    .optional()
    .describe('Optional thread timestamp to reply in a thread.'),
})

export default defineTool({
  description:
    'Post a structured message to a Slack channel. Used to send supervisor reports, ' +
    'flag notifications, and cohort digests to the #supervisor channel or individual supervisors.',
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    // This tool relies on the agent's Slack channel being configured.
    // The eve framework handles Slack posting when the agent returns a response
    // through the slackChannel. This tool signals the agent to format and post.
    return {
      channel: input.channel,
      message_preview: input.message.slice(0, 100),
      length: input.message.length,
      thread: input.thread_ts ?? null,
      status: 'queued',
      note: 'Message will be delivered through the configured Slack channel on the next agent turn.',
    }
  },
})
