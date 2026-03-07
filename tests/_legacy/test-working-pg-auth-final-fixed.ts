import {
  registerWithBetterAuth,
  authenticateWithBetterAuth,
  logoutFromBetterAuth,
  getBetterAuthInstance
} from './src/lib/auth/working-pg-auth-final-fixed'

async function demonstrateWorkingAuthIntegration() {
  try {
    console.log('🚀 Starting Working Better-Auth PostgreSQL Integration Demo (Fixed Version)')

    // Get Better-Auth instance
    const auth = getBetterAuthInstance()
    console.log('✅ Better-Auth instance initialized')

    // Register a new user
    console.log('\n📝 Registering new user...')
    const registerResult = await registerWithBetterAuth(
      {
        email: 'workingdemo.fixed@example.com',
        password: 'SecurePassword123!',
        name: 'Working Demo User Fixed',
        role: 'therapist'
      },
      {
        ip: '127.0.0.1',
        userAgent: 'Working Demo Client'
      }
    )

    if (!registerResult.success) {
      throw new Error(`Registration failed: ${registerResult.error}`)
    }

    console.log('✅ User registered successfully!')
    console.log('User ID:', registerResult.user?.id)
    console.log('Access Token:', registerResult.tokens?.accessToken.substring(0, 20) + '...')

    // Authenticate the user
    console.log('\n🔐 Authenticating user...')
    const authResult = await authenticateWithBetterAuth(
      {
        email: 'workingdemo.fixed@example.com',
        password: 'SecurePassword123!'
      },
      {
        ip: '127.0.0.1',
        userAgent: 'Working Demo Client'
      }
    )

    if (!authResult.success) {
      throw new Error(`Authentication failed: ${authResult.error}`)
    }

    console.log('✅ User authenticated successfully!')
    console.log('User ID:', authResult.user?.id)
    console.log('Role:', authResult.user?.role)
    console.log('Access Token:', authResult.tokens?.accessToken.substring(0, 20) + '...')

    // Logout the user
    console.log('\n👋 Logging out user...')
    if (authResult.user?.id) {
      await logoutFromBetterAuth(
        authResult.user.id,
        {
          ip: '127.0.0.1',
          userAgent: 'Working Demo Client'
        }
      )
      console.log('✅ User logged out successfully!')
    }

    // Test Better-Auth API directly
    console.log('\n🧪 Testing Better-Auth API directly...')
    const userList = await auth.api.listUsers()
    console.log(`✅ Found ${userList.length} users in the system`)

    console.log('\n🎉 Working authentication demo completed successfully!')

  } catch (error) {
    console.error('❌ Demo failed:', error)
  }
}

// Run the demo
demonstrateWorkingAuthIntegration()