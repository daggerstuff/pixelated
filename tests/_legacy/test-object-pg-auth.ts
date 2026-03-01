import { auth } from './src/lib/auth/object-pg-auth'

async function testObjectAuth() {
  try {
    console.log('🚀 Testing Object Better-Auth PostgreSQL Integration')

    // Test user creation
    console.log('\n📝 Creating test user...')
    const user = await auth.api.signUpEmail({
      body: {
        email: 'objecttest@example.com',
        password: 'SecurePassword123!',
        name: 'Object Test User',
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
        email: 'objecttest@example.com',
        password: 'SecurePassword123!',
      },
    })

    if (!session) {
      throw new Error('Failed to authenticate user')
    }

    console.log('✅ User authenticated successfully!')
    console.log('Session ID:', session.session.id)

    console.log('\n🎉 Object auth test completed!')
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test and handle any unhandled rejections
testObjectAuth()
  .catch((error) => {
    console.error('Unhandled error:', error)
  })
