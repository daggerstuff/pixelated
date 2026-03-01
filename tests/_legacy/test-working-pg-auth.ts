import { auth } from './src/lib/auth/working-pg-auth'

async function testWorkingAuth() {
  try {
    console.log('🚀 Testing Working Better-Auth PostgreSQL Integration')

    // Test user creation
    console.log('\n📝 Creating test user...')
    const user = await auth.api.signUpEmail({
      body: {
        email: 'workingtest@example.com',
        password: 'SecurePassword123!',
        name: 'Working Test User',
      },
    })

    if (!user) {
      throw new Error('Failed to create user')
    }

    console.log('✅ User created successfully!')
    console.log('User ID:', user.user.id)

    // Test user authentication
    console.log('\n🔐 Authenticating user...')
    const session = await auth.api.signInEmail({
      body: {
        email: 'workingtest@example.com',
        password: 'SecurePassword123!',
      },
    })

    if (!session) {
      throw new Error('Failed to authenticate user')
    }

    console.log('✅ User authenticated successfully!')
    console.log('Session ID:', session.session.id)

    console.log('\n🎉 Working auth test completed!')
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

void testWorkingAuth()
