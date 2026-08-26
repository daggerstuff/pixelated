import { z } from 'zod'

export const aiEnvSchema = z.object({
  // AI Provider APIs
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.url().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_BASE_URL: z.url().optional(),
  LLM_API_URL: z.url().optional(),
  JIGSAWSTACK_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  REPLICATE_API_TOKEN: z.string().optional(),

  // Neon AI Gateway (free during beta)
  NEON_AI_GATEWAY_TOKEN: z.string().optional(),
  NEON_AI_GATEWAY_BASE_URL: z.url().optional(),

  // Default LLM model — env-configurable for Neon or any OpenAI-compatible provider
  LLM_DEFAULT_MODEL: z.string().optional(),
  LLM_PRIMARY_MODEL: z.string().optional(),
  LLM_SECONDARY_MODEL: z.string().optional(),

  // Azure OpenAI
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_ENDPOINT: z.url().optional(),
  AZURE_OPENAI_API_VERSION: z.string().optional(),
  AZURE_OPENAI_DEPLOYMENT_NAME: z.string().optional(),

  // MentalLLaMA
  MENTALLAMA_API_KEY: z.string().optional(),
  MENTALLAMA_ENDPOINT_URL_7B: z.url().optional(),
  MENTALLAMA_ENDPOINT_URL_13B: z.url().optional(),
  MENTALLAMA_DEFAULT_MODEL_TIER: z.enum(['7B', '13B']).optional(),
  MENTALLAMA_ENABLE_PYTHON_BRIDGE: z
    .string()
    .transform((val: string) => val === 'true')
    .optional(),
  MENTALLAMA_PYTHON_BRIDGE_SCRIPT_PATH: z.string().optional(),

  // AI Microservice (PIX-3926)
  AI_SERVICE_URL: z.url().optional(),
  AI_SERVICE_API_KEY: z.string().optional(),
})
