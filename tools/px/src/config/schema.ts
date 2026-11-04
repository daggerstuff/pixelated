import { z } from 'zod'

export const AgentConfigSchema = z.object({
  endpoint: z.string().url(),
  tools: z.array(z.string().min(1)),
  async: z.boolean().default(false),
  timeout: z.number().int().positive().default(30000),
})

export const SlackConfigSchema = z.object({
  webhook: z.string().optional(),
  channel: z.string().optional(),
})

export const HookConfigSchema = z.object({
  agent: z.string().min(1),
  tool: z.string().min(1),
  filter: z.string().optional(),
  async: z.boolean().optional(),
})

export const HookEventSchema = z.enum([
  'pre-commit',
  'pre-push',
  'post-merge',
  'pr-open',
  'pr-merge',
])

export const WorkspaceConfigSchema = z.object({
  endpoint: z.string().url(),
  token: z.string().optional(),
  timeout: z.number().int().positive().default(30000),
})

export const PxConfigSchema = z.object({
  agents: z.record(z.string(), AgentConfigSchema),
  slack: SlackConfigSchema.optional(),
  hooks: z.record(z.string(), HookConfigSchema).optional(),
  workspace: WorkspaceConfigSchema.optional(),
})

/** Validates merged config (allows empty agents when no files are present). */
const MergedPxConfigSchema = PxConfigSchema.extend({
  agents: z.record(z.string(), AgentConfigSchema).default({}),
})

export type AgentConfig = z.infer<typeof AgentConfigSchema>
export type SlackConfig = z.infer<typeof SlackConfigSchema>
export type HookConfig = z.infer<typeof HookConfigSchema>
export type HookEvent = z.infer<typeof HookEventSchema>
export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>
export type PxConfig = z.infer<typeof PxConfigSchema>

export function parsePxConfig(input: unknown): PxConfig {
  return MergedPxConfigSchema.parse(input)
}
