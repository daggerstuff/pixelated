import { betterAuth } from 'better-auth'
import dotenv from 'dotenv'

dotenv.config()

console.log('🚀 Testing better-auth with Neon PostgreSQL')

// Create the auth instance
const auth = betterAuth({
  database: process.env.DATABASE_URL,
  emailAndPassword: {
    enabled: true,
  },
})

async function testBetterAuth() {
  try {
    console.log('Testing minimal API calls...')

    // Try to create a user
    console.log('\n📝 Creating user...')
    const result = await auth.api.signUpEmail({
      body: {
        email: 'fixedtest@example.com',
        password: 'SecurePassword123!',
        name: 'Fixed Test User',
      },
    })

    console.log('✅ User created!')
    console.log('User ID:', result.user.id)
    console.log('Email:', result.user.email)

    // Try to sign in
    console.log('\n🔐 Authenticating user...')
    const authResult = await auth.api.signInEmail({
      body: {
        email: 'fixedtest@example.com',
        password: 'SecurePassword123!',
        rememberMe: true,
      },
    })

    console.log('✅ Authentication successful!')
    console.log('Authenticated User ID:', authResult.user.id)
    console.log(
      '\n🎉 All tests passed! Better-Auth with PostgreSQL is working!',
    )
  } catch (error) {
    console.error('❌ Error:', error)
    console.error(
      'Stack:',
      error instanceof Error ? error.stack : 'No stack available',
    )
  }
}

void testBetterAuth()
