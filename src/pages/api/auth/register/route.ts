import { userManager, initializeDatabase } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/utils'
import { z } from 'zod'

// Register schema
const RegisterSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  termsAccepted: z.boolean(),
})

export async function POST({ request }: { request: Request }) {
  try {
    // Initialize database if not already done
    initializeDatabase()

    // Parse request body
    const body = await request.json()

    // Validate request data
    const result = RegisterSchema.safeParse(body)
    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error.errors[0].message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { fullName, email, password, termsAccepted } = result.data

    // Additional validation
    if (!termsAccepted) {
      return new Response(
        JSON.stringify({ error: 'You must accept the Terms of Service' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Check if user already exists
    const existingUser = await userManager.getUserByEmail(email)
    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Email already registered' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Hash password
    const hashedPassword = await verifyPassword(password, '') // This will hash the password

    // Split full name
    const nameParts = fullName.split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    // Create new user
    const userId = await userManager.createUser({
      email,
      passwordHash: hashedPassword,
      firstName,
      lastName,
      role: 'user',
    })

    return new Response(
      JSON.stringify({
        message: 'User registered successfully',
        userId
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Registration error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
