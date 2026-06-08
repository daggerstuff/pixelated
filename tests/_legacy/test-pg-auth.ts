import { auth } from './src/lib/auth/pg-auth-service'

async function testAuth() {
  try {
    console.log('🚀 Testing Better-Auth PostgreSQL Integration')

    // Test user creation
    console.log('\n📝 Creating test user...')
    const user = await auth.api.signUpEmail({
      body: {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        name: 'Test User',
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
        email: 'test@example.com',
        password: 'SecurePassword123!',
      },
    })

    if (!session) {
      throw new Error('Failed to authenticate user')
    }

    console.log('✅ User authenticated successfully!')
    console.log('Session ID:', session.session.id)

    // Test listing users
    console.log('\n📋 Listing users...')
    const users = await auth.api.listUsers()
    console.log(`✅ Found ${users.length} users`)

    console.log('\n🎉 All tests passed!')
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

void testAuth()
