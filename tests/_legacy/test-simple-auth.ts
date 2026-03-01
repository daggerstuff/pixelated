import { simpleAuth } from './src/lib/auth/working-pg-auth-simplified'

async function testSimpleAuth() {
  try {
    console.log('Testing simple auth wrapper...')

    // Test registration
    console.log('\n📝 Registering test user...')
    const registerResult = await simpleAuth.register(
      'simplerawtest@example.com',
      'SecurePassword123!',
      'Simple Raw Test User',
    )

    if (registerResult.success && registerResult.user) {
      console.log('✅ Registration successful!')
      console.log('User ID:', registerResult.user.id)
      console.log('Email:', registerResult.user.email)
    } else {
      console.log('❌ Registration failed:', registerResult.error)
    }

    // Test login
    console.log('\n🔐 Logging in test user...')
    const loginResult = await simpleAuth.login(
      'simplerawtest@example.com',
      'SecurePassword123!',
    )

    if (loginResult.success && loginResult.user) {
      console.log('✅ Login successful!')
      console.log('Authenticated User ID:', loginResult.user.id)

      // List users
      console.log('\n📋 Listing users...')
      const users = await simpleAuth.listUsers()
      console.log(`Found ${users.length} users in the system`)

      for (const user of users) {
        console.log(`- ${user.email} (ID: ${user.id})`)
      }

      console.log('\n🎉 All tests passed!')
    } else {
      console.log('❌ Login failed:', loginResult.error)
    }
  } catch (error) {
    console.error('❌ Test failed:', error)
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack)
    }
  }
}

void // Run the test and handle any unhandled rejections
testSimpleAuth()
  .catch((error) => {
    console.error('Unhandled error:', error)
  })
