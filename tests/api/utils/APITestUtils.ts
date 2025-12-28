/**
 * API Test Utilities
 * Helper functions for API testing
 */

export class APITestUtils {
  private baseUrl: string
  private testUsers: Map<string, any> = new Map()
  private testConversations: string[] = []
  private testFiles: string[] = []

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl
  }

  /**
   * Setup test environment
   */
  async setupTestEnvironment(): Promise<void> {
    // Create test users and data
    await this.createTestUsers()
    console.log('API test environment setup complete')
  }

  /**
   * Cleanup test environment
   */
  async cleanupTestEnvironment(): Promise<void> {
    // Clean up test data
    await this.cleanupTestUsers()
    await this.cleanupTestConversations()
    await this.cleanupTestFiles()
    console.log('API test environment cleanup complete')
  }

  /**
   * Get a valid authentication token
   */
  async getValidToken(): Promise<string> {
    const testUser = this.testUsers.get('primary')
    if (testUser && testUser.token) {
      return testUser.token
    }

    // Create and authenticate a test user
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testPassword123',
      }),
    })

    if (response.ok) {
      // const _data = await response.json();
      this.testUsers.set('primary', { ...response, token: response.token })
      return response.token
    }

    throw new Error('Failed to get valid token')
  }

  /**
   * Create a test user and return token
   */
  async createTestUser(userData?: any): Promise<string> {
    const uniqueId = Date.now()
    const defaultUserData = {
      email: `test${uniqueId}@example.com`,
      password: 'testPassword123',
      name: `Test User ${uniqueId}`,
    }

    const user = { ...defaultUserData, ...userData }

    const response = await fetch(`${this.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(user),
    })

    if (response.ok) {
      const data = await response.json()
      const loginResponse = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
        }),
      })

      if (loginResponse.ok) {
        const loginData = await loginResponse.json()
        this.testUsers.set(`user_${uniqueId}`, {
          ...loginData.user,
          token: loginData.token,
        })
        return loginData.token
      }
    }

    throw new Error('Failed to create test user')
  }

  /**
   * Create a test conversation
   */
  async createTestConversation(token?: string): Promise<string> {
    const authToken = token || (await this.getValidToken())

    const response = await fetch(`${this.baseUrl}/api/chat/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        title: `Test Conversation ${Date.now()}`,
        type: 'general',
      }),
    })

    if (response.ok) {
      const data = await response.json()
      this.testConversations.push(data.id)
      return data.id
    }

    throw new Error('Failed to create test conversation')
  }

  /**
   * Upload a test file
   */
  async uploadTestFile(token?: string): Promise<string> {
    const authToken = token || (await this.getValidToken())
    const testContent = `Test file content ${Date.now()}`

    const formData = new FormData()
    formData.append(
      'file',
      new Blob([testContent], { type: 'text/plain' }),
      'test.txt',
    )
    formData.append(
      'metadata',
      JSON.stringify({
        description: 'Test file for API testing',
        category: 'test',
      }),
    )

    const response = await fetch(`${this.baseUrl}/api/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: formData,
    })

    if (response.ok) {
      const data = await response.json()
      this.testFiles.push(data.fileId)
      return data.fileId
    }

    throw new Error('Failed to upload test file')
  }

  /**
   * Create test users for testing
   */
  private async createTestUsers(): Promise<void> {
    try {
      // Try to create primary test user
      await this.createTestUser({
        email: 'test@example.com',
        password: 'testPassword123',
        name: 'Primary Test User',
      })
    } catch (error: unknown) {
      // User might already exist, try to login
      try {
        await this.getValidToken()
      } catch (loginError) {
        console.warn('Could not create or login test user:', loginError)
      }
    }
  }

  /**
   * Cleanup test users
   */
  private async cleanupTestUsers(): Promise<void> {
    for (const [key, user] of this.testUsers) {
      try {
        await fetch(`${this.baseUrl}/api/user/account`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        })
      } catch (_error: unknown) {
        console.warn(`Failed to cleanup user ${key}:`, _error)
      }
    }
    this.testUsers.clear()
  }

  /**
   * Cleanup test conversations
   */
  private async cleanupTestConversations(): Promise<void> {
    const token = await this.getValidToken().catch(() => null)
    if (!token) {
      return
    }

    for (const conversationId of this.testConversations) {
      try {
        await fetch(
          `${this.baseUrl}/api/chat/conversations/${conversationId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        )
      } catch (_error: unknown) {
        console.warn(`Failed to cleanup conversation ${conversationId}:`, _error)
      }
    }
    this.testConversations = []
  }

  /**
   * Cleanup test files
   */
  private async cleanupTestFiles(): Promise<void> {
    const token = await this.getValidToken().catch(() => null)
    if (!token) {
      return
    }

    for (const fileId of this.testFiles) {
      try {
        await fetch(`${this.baseUrl}/api/files/${fileId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      } catch (_error: unknown) {
        console.warn(`Failed to cleanup file ${fileId}:`, _error)
      }
    }
    this.testFiles = []
  }

  /**
   * Validate API response structure
   */
  static validateApiResponse(response: any, expectedFields: string[]): boolean {
    for (const field of expectedFields) {
      if (!(field in response)) {
        return false
      }
    }
    return true
  }

  /**
   * Generate test data for API requests
   */
  static generateTestData(
    type: 'user' | 'message' | 'conversation' | 'file',
  ): any {
    const timestamp = Date.now()

    switch (type) {
      case 'user':
        return {
          email: `test${timestamp}@example.com`,
          password: 'testPassword123',
          name: `Test User ${timestamp}`,
          preferences: {
            theme: 'light',
            notifications: true,
          },
        }

      case 'message':
        return {
          content: `Test message content ${timestamp}`,
          type: 'text',
          metadata: {
            timestamp: new Date().toISOString(),
            source: 'api_test',
          },
        }

      case 'conversation':
        return {
          title: `Test Conversation ${timestamp}`,
          type: 'general',
          participants: [],
          settings: {
            private: false,
            archived: false,
          },
        }

      case 'file':
        return {
          name: `test_file_${timestamp}.txt`,
          content: `Test file content generated at ${new Date().toISOString()}`,
          metadata: {
            description: 'Generated test file',
            category: 'test',
            tags: ['api-test', 'generated'],
          },
        }

      default:
        return {}
    }
  }

  /**
   * Wait for async operation to complete
   */
  static async waitForCondition(
    condition: () => Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100,
  ): Promise<boolean> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true
      }
      await new Promise((resolve) => setTimeout(resolve, interval))
    }

    return false
  }

  /**
   * Measure API response time
   */
  static async measureResponseTime(apiCall: () => Promise<any>): Promise<{
    result: any
    responseTime: number
  }> {
    const startTime = Date.now()
    const result = await apiCall()
    const responseTime = Date.now() - startTime

    return { result, responseTime }
  }

  /**
   * Batch API requests for performance testing
   */
  static async batchRequests(
    requests: (() => Promise<any>)[],
    concurrency: number = 5,
  ): Promise<any[]> {
    const results = []

    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency)
      const batchResults = await Promise.all(batch.map((req) => req()))
      results.push(...(batchResults as any))
    }

    return results
  }
}
