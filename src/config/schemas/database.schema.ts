import { z } from 'zod'

export const databaseEnvSchema = z.object({
  // MongoDB Atlas
  MONGODB_URI: z.string().optional(),
  MONGODB_DB_NAME: z.string().optional(),
  MONGODB_USERNAME: z.string().optional(),
  MONGODB_PASSWORD: z.string().optional(),
  MONGODB_CLUSTER: z.string().optional(),

  // Legacy database (PostgreSQL)
  POSTGRES_URL: z.string().optional(),
  POSTGRES_PRISMA_URL: z.string().optional(),
  POSTGRES_URL_NON_POOLING: z.string().optional(),

  // Redis
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  REDIS_URL: z.string().optional(),
  REDIS_TOKEN: z.string().optional(),
})
