import type { APIRoute, APIContext } from 'astro'
import { mongodb } from '@/config/mongodb.config'
import { AuditEventType, createAuditLog } from '@/lib/audit'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
})

/**
 * Astro API route handler for user registration
 * This export is automatically used by Astro's routing system
 */

export const POST = async ({ request }: APIContext) => {
  try {
    const body = await request.json()
    const { email, password, fullName } = RegisterSchema.parse(body)

    // Connect to MongoDB
    const db = await mongodb.connect()
    const usersCollection = db.collection('users')

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email })
    if (existingUser) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'User with this email already exists',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)
    const userId = uuidv4()

    // Create user
    const newUser = {
      id: userId,
      email,
      password: hashedPassword,
      full_name: fullName,
      role: 'user',
      created_at: new Date(),
      updated_at: new Date(),
      email_verified: false,
      verification_token: uuidv4(),
    }

    await usersCollection.insertOne(newUser)

    // Log the registration for HIPAA compliance
    await createAuditLog(
      AuditEventType.REGISTER,
      'auth.signup',
      userId,
      'auth',
      {
        email: email,
        timestamp: new Date().toISOString(),
      },
    )

    return new Response(
      JSON.stringify({
        success: true,
        message:
          'Registration successful. Please check your email for verification.',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
