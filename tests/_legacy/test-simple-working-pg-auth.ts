import { betterAuth } from 'better-auth'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

console.log('🚀 Testing simple working better-auth with Neon PostgreSQL')

try {
  console.log('Attempting to initialize better-auth with DATABASE_URL...')

  // Simple test - just try to create the auth instance
  const auth = betterAuth({
    database: process.env.DATABASE_URL,
    emailAndPassword: {
      enabled: true,
    },
  })

  console.log('✅ Better-Auth instance created successfully')

  // Test user creation
  console.log('\n📝 Creating test user...')
  auth.api
    .signUpEmail({
      body: {
        email: 'simpletest@example.com',
        password: 'SecurePassword123!',
        name: 'Simple Test User',
      },
    })
    .then((user) => {
      if (!user) {
        throw new Error('Failed to create user')
      }

      console.log('✅ User created successfully!')
      console.log('User ID:', user.user.id)

      console.log('\n🎉 Simple auth test completed!')
    })
    .catch((error) => {
      console.error('❌ Test failed:', error)
    })
} catch (error) {
  console.error('❌ Failed to initialize better-auth:', error)
  console.error('Error type:', typeof error)
  console.error(
    'Error message:',
    error instanceof Error ? error.message : String(error),
  )
}
