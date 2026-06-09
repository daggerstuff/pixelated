import { auth } from './src/lib/auth/working-pg-auth-final'

async function testImportOnly() {
  try {
    console.log('🚀 Testing Import Only')

    // Test user creation
    console.log('\n📝 Creating test user...')
    const user = await auth.api.signUpEmail({
      body: {
        email: 'importtest@example.com',
        password: 'SecurePassword123!',
        name: 'Import Test User',
      },
    })

    if (!user) {
      throw new Error('Failed to create user')
    }

    console.log('✅ User created successfully!')
    console.log('User ID:', user.user.id)

    console.log('\n🎉 Import only test completed!')
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

void testImportOnly()
