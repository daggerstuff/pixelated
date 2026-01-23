import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { RegisterSchema } from '@/lib/validation/registerSchema'
import { z } from 'zod'
import { hash } from 'bcrypt'
import { validate } from '@/lib/validation/validator'
import { AuthError } from '@/lib/errors/AuthError'

const schema = RegisterSchema

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = schema.safeParse(body)

    if (!result.success) {
      return new NextResponse(
        JSON.stringify({ error: result.error.errors[0].message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { fullName, email, password, termsAccepted } = result.data

    // Check if terms were accepted
    if (!termsAccepted) {
      return new NextResponse(
        JSON.stringify({ error: 'You must accept the Terms of Service' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (checkError) {
      return new NextResponse(
        JSON.stringify({ error: 'Email already registered' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Hash password
    const hashedPassword = await hash(password, 10)

    // Create new user
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        email,
        full_name: fullName,
        password_hash: hashedPassword,
        role: 'user',
      })
      .select('id, email, full_name, created_at')
      .single()

    if (createError) {
      return new NextResponse(
        JSON.stringify({ error: 'Failed to create user' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new NextResponse(
      JSON.stringify({ message: 'User registered successfully' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    if (error instanceof AuthError) {
      return new NextResponse(
        JSON.stringify({ error: error.message }),
        { status: error.statusCode || 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}