import { z } from 'zod'

export const aiEnvSchema = z.object({
  // AI Provider APIs
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  TOGETHER_API_KEY: z.string().optional(),
  JIGSAWSTACK_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  REPLICATE_API_TOKEN: z.string().optional(),

  // Azure OpenAI
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_ENDPOINT: z.string().url().optional(),
  AZURE_OPENAI_API_VERSION: z.string().optional(),
  AZURE_OPENAI_DEPLOYMENT_NAME: z.string().optional(),

  // MentalLLaMA
  MENTALLAMA_API_KEY: z.string().optional(),
  MENTALLAMA_ENDPOINT_URL_7B: z.string().url().optional(),
  MENTALLAMA_ENDPOINT_URL_13B: z.string().url().optional(),
  MENTALLAMA_DEFAULT_MODEL_TIER: z.enum(['7B', '13B']).optional(),
  MENTALLAMA_ENABLE_PYTHON_BRIDGE: z
    .string()
    .transform((val: string) => val === 'true')
    .optional(),
  MENTALLAMA_PYTHON_BRIDGE_SCRIPT_PATH: z.string().optional(),
})
