import mongodb from '@/config/mongodb.config'
import { mongoAuthService } from '@/services/mongoAuth.service'

const mongoUri = process.env['MONGODB_URI']
const mongoDbName = process.env.MONGODB_DB_NAME

// Create mock client for builds
function createMockClient() {
  console.warn(
    'Using mock MongoDB client in db module. This should not be used in production.',
  )
  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
    },
    from: () => ({
      insert: () => Promise.resolve({ error: null }),
      select: () => ({
        eq: () => ({
          order: () => ({
            range: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
  }
}

// Use MongoDB client if credentials are available, otherwise use mock
export const mongoClient =
  mongoUri && mongoDbName ? mongodb : (createMockClient() as unknown)

// Export MongoDB auth service as main auth interface
// Prefer adapter for new codepaths
export { default as authAdapter } from '@/adapters/betterAuthMongoAdapter'
export const authService = mongoAuthService
