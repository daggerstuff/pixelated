import { auth } from './src/lib/auth/minimal-pg-auth'

async function testMinimalAuth() {
  try {
    console.log('🚀 Testing Minimal Better-Auth PostgreSQL Integration')

    // Test user creation
    console.log('\n📝 Creating test user...')
    const user = await auth.api.signUpEmail({
      body: {
        email: 'minimaltest@example.com',
        password: 'SecurePassword123!',
        name: 'Minimal Test User',
      },
    })

    if (!user) {
      throw new Error('Failed to create user')
    }

    console.log('✅ User created successfully!')
    console.log('User ID:', user.user.id)

    console.log('\n🎉 Minimal auth test completed!')
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

void testMinimalAuth()
