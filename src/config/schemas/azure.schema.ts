import { z } from 'zod'

export const azureEnvSchema = z.object({
  // Azure Storage
  AZURE_STORAGE_CONNECTION_STRING: z.string().optional(),
  AZURE_STORAGE_ACCOUNT_NAME: z.string().optional(),
  AZURE_STORAGE_ACCOUNT_KEY: z.string().optional(),
  AZURE_STORAGE_CONTAINER_NAME: z.string().optional(),
})
