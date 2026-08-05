import { z } from 'zod'

const agentConfigSchema = z.object({
  endpoint: z.string().url(),
  tools: z.array(z.string().min(1)),
  async: z.boolean().default(false),
  timeout: z.number().int().positive().default(30_000),
})

const slackConfigSchema = z.object({
  webhook: z.string().optional(),
  channel: z.string().optional(),
})

const hookConfigSchema = z.object({
  agent: z.string().min(1),
  tool: z.string().min(1),
  filter: z.string().optional(),
})

const pxConfigSchema = z.object({
  agents: z.record(z.string(), agentConfigSchema).default({}),
  slack: slackConfigSchema.optional(),
  hooks: z.record(z.string(), hookConfigSchema).optional(),
})

type AgentConfig = z.infer<typeof agentConfigSchema>
type SlackConfig = z.infer<typeof slackConfigSchema>
type HookConfig = z.infer<typeof hookConfigSchema>
export type PxConfig = z.infer<typeof pxConfigSchema>

export function parsePxConfig(input: unknown): PxConfig {
  return pxConfigSchema.parse(input)
}

