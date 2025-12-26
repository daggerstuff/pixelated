import dotenv from 'dotenv'
import { betterAuth } from 'better-auth'

// Load environment variables
dotenv.config()

// Simple Better-Auth configuration
export const auth = betterAuth({
  database: process.env.DATABASE_URL,
  emailAndPassword: {
    enabled: true,
  },
})

export interface User {
  id: string
  email: string
  name?: string
  emailVerified?: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface AuthResponse {
  success: boolean
  user?: User
  error?: string
}

/**
 * Simple authentication wrapper that avoids the problem
 */
export class SimpleAuthService {
  private auth: typeof auth

  constructor() {
    this.auth = auth
  }

  /**
   * Register a new user
   */
  async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    try {
      // Use the minimal API that we know works from the test-minimal-pg-auth.ts
      const result = await this.auth.api.signUpEmail({
        body: {
          email,
          password,
          name: name || email.split('@')[0],
        },
      })

      if (result && result.user) {
        return {
          success: true,
          user: result.user,
        }
      }

      return {
        success: false,
        error: 'Registration failed - no user returned',
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      }
    }
  }

  /**
   * Authenticate a user
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const result = await this.auth.api.signInEmail({
        body: {
          email,
          password,
          rememberMe: false,
        },
      })

      if (result && result.user) {
        return {
          success: true,
          user: result.user,
        }
      }

      return {
        success: false,
        error: 'Invalid credentials',
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }
    }
  }

  /**
   * List all users
   */
  async listUsers(): Promise<User[]> {
    try {
      const users = await this.auth.api.listUsers()
      return users
    } catch (error) {
      console.warn('Error listing users:', error)
      return []
    }
  }
}

export const simpleAuth = new SimpleAuthService()