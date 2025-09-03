import * as bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'
// Use type-only imports for Mongo types
import type { ObjectId as MongoObjectId, Db } from 'mongodb'

// Runtime shape of our MongoDB wrapper
type MongoRuntime = { connect: () => Promise<Db>; getDb: () => Db; client?: any }

// Use conditional imports to prevent MongoDB from being bundled on client side
let mongodb: MongoRuntime | null = null
let ObjectId: any

if (typeof window === 'undefined') {
  // Server side - import real MongoDB dependencies
  try {
  const mod = require('../config/mongodb.config')
  mongodb = mod.default as MongoRuntime
  const mongodbLib = require('mongodb')
  ObjectId = mongodbLib.ObjectId
  } catch {
    // Fallback if MongoDB is not available
    mongodb = null
    ObjectId = class MockObjectId {
      public id: string
      constructor(id?: string) {
        this.id = id || 'mock-object-id'
      }
      toString() { return this.id }
      toHexString() { return this.id }
    }
  }
} else {
  // Client side - use mocks
  mongodb = null
  ObjectId = class MockObjectId {
    public id: string
    constructor(id?: string) {
      this.id = id || 'mock-object-id'
    }
    toString() { return this.id }
    toHexString() { return this.id }
  }
}
import type { Session, User } from '../types/mongodb.types'

interface AuthTokenPayload {
  userId: string
  email: string
  role: string
}

interface AuthResult {
  user: User
  session: Session
  accessToken: string
}

export class MongoAuthService {
  private readonly JWT_SECRET: string = process.env['JWT_SECRET'] || 'your-secret-key'
  private readonly JWT_EXPIRES_IN: string = process.env['JWT_EXPIRES_IN'] || '7d'
  private readonly SALT_ROUNDS = 12

  async createUser(
    email: string,
    password: string,
    role: 'admin' | 'user' | 'therapist' = 'user',
  ): Promise<User> {
  const db = await mongodb!.connect()
    const usersCollection = db.collection<User>('users')

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email })
    if (existingUser) {
      throw new Error('User already exists')
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS)

    // Create user
    const newUser: Omit<User, '_id'> = {
      email,
      password: hashedPassword,
      role,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      id: '',
      profile: undefined
    }

    const result = await usersCollection.insertOne(newUser as User)
    const user = await usersCollection.findOne({ _id: result.insertedId })

    if (!user) {
      throw new Error('Failed to create user')
    }

    return user
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
  const db = await mongodb!.connect()
  const usersCollection = db.collection<User>('users')
  const sessionsCollection = db.collection<Session>('sessions')

    // Find user
    const user = await usersCollection.findOne({ email })
    if (!user) {
      throw new Error('Invalid credentials')
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      throw new Error('Invalid credentials')
    }

    // Create session
    const sessionId = new ObjectId()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const session: Omit<Session, '_id'> = {
      userId: user._id,
      sessionId: String(sessionId && (sessionId as any).toString ? (sessionId as any).toString() : sessionId),
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await sessionsCollection.insertOne({ ...session, _id: sessionId })

    // Generate JWT
    const accessToken = this.generateToken({
      userId: String(user._id && (user._id as any).toString ? (user._id as any).toString() : user._id),
      email: user.email,
      role: user.role,
    })

    return {
      user,
      session: { ...session, _id: sessionId },
      accessToken,
    }
  }

  async signOut(sessionId: string): Promise<void> {
  const db = await mongodb!.connect()
    const sessionsCollection = db.collection<Session>('sessions')

    await sessionsCollection.deleteOne({ sessionId })
  }

  async refreshSession(accessToken: string): Promise<AuthResult> {
    try {
      // Verify current token
      const payload = this.verifyToken(accessToken) as AuthTokenPayload

    const db = await mongodb!.connect()
    const usersCollection = db.collection<User>('users')
    const sessionsCollection = db.collection<Session>('sessions')

      // Get user
      const user = await usersCollection.findOne({
        _id: new ObjectId(payload.userId),
      })
      if (!user) {
        throw new Error('User not found')
      }

      // Find active session
      const existingSession = await sessionsCollection.findOne({
        userId: user._id,
        expiresAt: { $gt: new Date() },
      })

      if (!existingSession) {
        throw new Error('No active session found')
      }

      // Update session expiry
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      await sessionsCollection.updateOne(
        { _id: existingSession._id },
        {
          $set: {
            expiresAt: newExpiresAt,
            updatedAt: new Date(),
          },
        },
      )

      // Generate new JWT
      const newAccessToken = this.generateToken({
        userId: String(user._id && (user._id as any).toString ? (user._id as any).toString() : user._id),
        email: user.email,
        role: user.role,
      })

      const updatedSession = await sessionsCollection.findOne({
        _id: existingSession._id,
      })

      return {
        user,
        session: updatedSession!,
        accessToken: newAccessToken,
      }
  } catch {
      throw new Error('Failed to refresh session')
    }
  }

  async verifyAuthToken(token: string): Promise<AuthTokenPayload> {
    try {
      return this.verifyToken(token) as AuthTokenPayload
  } catch {
      throw new Error('Invalid token')
    }
  }

  async getUserById(userId: string): Promise<User | null> {
  const db = await mongodb!.connect()
  const usersCollection = db.collection<User>('users')

    return await usersCollection.findOne({ _id: new ObjectId(userId) })
  }

  async updateUser(
    userId: string,
    updates: Partial<User>,
  ): Promise<User | null> {
  const db = await mongodb!.connect()
  const usersCollection = db.collection<User>('users')

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { ...updates, updatedAt: new Date() } },
    )

    return await usersCollection.findOne({ _id: new ObjectId(userId) })
  }

  async changePassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS)

  const db = await mongodb!.connect()
    const usersCollection = db.collection<User>('users')

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { password: hashedPassword, updatedAt: new Date() } },
    )
  }

  private generateToken(payload: AuthTokenPayload): string {
    // Narrow cast through unknown to avoid any
    return (jwt.sign as unknown as (
      payload: string | object | Buffer,
      secretOrPrivateKey: jwt.Secret,
      options?: jwt.SignOptions,
    ) => string)(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    })
  }

  private verifyToken(token: string): AuthTokenPayload {
    return jwt.verify(token, this.JWT_SECRET) as AuthTokenPayload
  }
}

// Export singleton instance
export const mongoAuthService = new MongoAuthService()
