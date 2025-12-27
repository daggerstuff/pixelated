import {
  initializeDatabase,
  userManager,
  sessionManager,
  biasAnalysisManager,
  healthCheck
} from './src/lib/db/index'

// Initialize database connection
const db = initializeDatabase()

async function demonstrateDatabaseUsage() {
  try {
    console.log('🚀 Starting Pixelated Empathy Database Demo')

    // Check database health
    const health = await healthCheck()
    console.log('🏥 Database Health:', health)

    if (health.status !== 'healthy') {
      console.error('❌ Database is not healthy')
      return
    }

    // Create a new user (therapist)
    const userId = await userManager.createUser({
      email: 'demo.therapist@example.com',
      passwordHash: '$2b$10$example_hash_here', // In real app, use bcrypt
      firstName: 'Demo',
      lastName: 'Therapist',
      role: 'therapist',
      institution: 'Demo Institution',
      licenseNumber: 'DEMO123456'
    })

    console.log('👤 Created user with ID:', userId)

    // Get user by email
    const user = await userManager.getUserByEmail('demo.therapist@example.com')
    console.log('👤 Retrieved user:', {
      id: user.id,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      role: user.role
    })

    // Create a therapy session
    const sessionId = await sessionManager.createSession({
      therapistId: userId,
      sessionType: 'individual',
      context: {
        topic: 'Anxiety management',
        duration: 50,
        notes: 'Initial consultation'
      }
    })

    console.log('💬 Created session with ID:', sessionId)

    // Get session details
    const session = await sessionManager.getSessionById(sessionId)
    console.log('💬 Session details:', {
      id: session.id,
      therapist: `${session.first_name} ${session.last_name}`,
      type: session.session_type,
      startedAt: session.started_at
    })

    // Create a bias analysis (simulated)
    const analysisId = await biasAnalysisManager.saveAnalysis({
      sessionId: sessionId,
      therapistId: userId,
      overallBiasScore: 0.15,
      alertLevel: 'low',
      confidence: 0.92,
      layerResults: {
        demographic: 0.05,
        linguistic: 0.12,
        cultural: 0.08
      },
      recommendations: [
        'Consider exploring cultural background more deeply',
        'Validate client emotions more frequently'
      ],
      demographics: {
        age: 35,
        gender: 'female',
        ethnicity: 'caucasian',
        primaryLanguage: 'en'
      },
      contentHash: 'abc123demo',
      processingTimeMs: 450
    })

    console.log('📊 Created bias analysis with ID:', analysisId)

    // Get bias analysis summary
    const summary = await biasAnalysisManager.getBiasSummary(userId)
    console.log('📊 Bias analysis summary:', summary)

    console.log('✅ Database demo completed successfully!')

  } catch (error) {
    console.error('❌ Demo failed:', error)
  }
}

// Run the demo
demonstrateDatabaseUsage()