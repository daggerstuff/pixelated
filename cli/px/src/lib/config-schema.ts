import { z } from 'zod'

export const agentConfigSchema = z.object({
  endpoint: z.string().url(),
  tools: z.array(z.string().min(1)),
  async: z.boolean().default(false),
  timeout: z.number().int().positive().default(30_000),
})

export const slackConfigSchema = z.object({
  webhook: z.string().optional(),
  channel: z.string().optional(),
})

export const hookConfigSchema = z.object({
  agent: z.string().min(1),
  tool: z.string().min(1),
  filter: z.string().optional(),
})

export const pxConfigSchema = z.object({
  agents: z.record(z.string(), agentConfigSchema).default({}),
  slack: slackConfigSchema.optional(),
  hooks: z.record(z.string(), hookConfigSchema).optional(),
})

export type AgentConfig = z.infer<typeof agentConfigSchema>
export type SlackConfig = z.infer<typeof slackConfigSchema>
export type HookConfig = z.infer<typeof hookConfigSchema>
export type PxConfig = z.infer<typeof pxConfigSchema>

export function parsePxConfig(input: unknown): PxConfig {
  return pxConfigSchema.parse(input)
}
