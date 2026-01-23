import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import Auth0Provider from 'next-auth/providers/auth0'
import { JWT } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
import { auth } from '../../../lib/auth'
import { verifyPassword } from '../../../lib/auth/utils'
import { getUserByEmail } from '../../../lib/db/user.service'

const authOptions = {
  providers: [
    // Auth0 provider
    Auth0Provider({
      domain: process.env.PUBLIC_AUTH0_DOMAIN,
      clientId: process.env.PUBLIC_AUTH0_CLIENT_ID,
      authorization: {
        redirect_uri: process.env.AUTH0_REDIRECT_URI,
      },
    }),

    // Credentials provider for email/password
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await getUserByEmail(credentials.email)
        if (!user) return null

        const isValid = await verifyPassword(credentials.password, user.passwordHash)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.email = user.email
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.email = token.email
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
  debug: process.env.NODE_ENV === 'development',
})

export const { GET, POST } = auth(authOptions)

// Handle GET requests (for signIn redirects)
export const GET = auth(authOptions)

// Handle POST requests (for signIn)
export const POST = auth(authOptions)

// Optional: Customize the response for the session
export function getServerSession(req: Request) {
  return auth(authOptions)(req)
}

// Optional: Add type definitions for TypeScript
export type NextAuthOptions = typeof authOptions
export type JWT = JWT
export type Session = {
  user: {
    id: string
    email: string
    role: string
  }
}