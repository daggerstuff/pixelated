let bcrypt: typeof import('bcryptjs') | undefined
let jwt: typeof import('jsonwebtoken') | undefined
let mongodbLib: typeof import('mongodb') | undefined
let crypto: typeof import('crypto') | undefined
import type { Db, ObjectId as RealObjectId } from 'mongodb'

type MongoRuntime = {
  connect: () => Promise<Db>
  getDb: () => Db
  client?: unknown
}

class MockObjectId {
  public id: string
  constructor(id?: string) {
    this.id = id || 'mock-object-id'
  }
  toString() {
    return this.id
  }
  toHexString() {
    return this.id
  }
}

let mongodb: MongoRuntime | null = null
let ObjectId: typeof RealObjectId | typeof MockObjectId | null = null
let serverDepsPromise: Promise<void> | null = null

async function initializeDependencies() {
  if (serverDepsPromise) {
    return serverDepsPromise
  }
  if (typeof window === 'undefined') {
    serverDepsPromise = (async () => {
      try {
        const mod = await import('../config/mongodb.config')
        mongodb = mod.default as unknown as MongoRuntime
        mongodbLib = await import('mongodb')
        ObjectId = mongodbLib.ObjectId
        bcrypt = await import('bcryptjs')
        jwt = await import('jsonwebtoken')
      } catch {
        mongodb = null
        ObjectId = MockObjectId
        bcrypt = undefined
        jwt = undefined
      }
    })()
  } else {
    mongodb = null
    ObjectId = MockObjectId
    bcrypt = undefined
    jwt = undefined
    serverDepsPromise = Promise.resolve()
  }
  return serverDepsPromise
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

let MongoAuthServiceImpl: unknown = undefined
let mongoAuthService: unknown = undefined

if (typeof window === 'undefined') {
  MongoAuthServiceImpl = class MongoAuthService {
    private readonly JWT_SECRET: string =
      process.env['JWT_SECRET'] || 'your-secret-key'
    private readonly SALT_ROUNDS = 12

    async createUser(
      email: string,
      password: string,
      role: 'admin' | 'user' | 'therapist' = 'user',
    ): Promise<User> {
      await initializeDependencies()
      if (!mongodb || !bcrypt)
        throw new Error('MongoDB or bcrypt not available')
      const db = await mongodb.connect()
      const usersCollection = db.collection<User>('users')
      const existingUser = await usersCollection.findOne({ email })
      if (existingUser) throw new Error('User already exists')
      const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS)
      const newUser: Omit<User, '_id'> = {
        email,
        password: hashedPassword,
        role,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        id: '',
        profile: undefined,
      }
      const result = await usersCollection.insertOne(newUser as User)
      const user = await usersCollection.findOne({ _id: result.insertedId })
      if (!user) throw new Error('Failed to create user')
      return user
    }

    async signOut(sessionId: string): Promise<void> {
      await initializeDependencies()
      if (!mongodb) throw new Error('MongoDB not available')
      const db = await mongodb.connect()
      const sessionsCollection = db.collection<Session>('sessions')
      await sessionsCollection.deleteOne({ sessionId })
    }

    async refreshSession(accessToken: string): Promise<AuthResult> {
      await initializeDependencies()
      if (!mongodb) throw new Error('MongoDB not available')
      try {
        const payload = this.verifyToken(accessToken) as AuthTokenPayload
        const db = await mongodb.connect()
        const usersCollection = db.collection<User>('users')
        const sessionsCollection = db.collection<Session>('sessions')
        if (!ObjectId) throw new Error('ObjectId is not available')
        const user = await usersCollection.findOne({
          _id: new ObjectId(payload.userId),
        })
        if (!user) throw new Error('User not found')
        const existingSession = await sessionsCollection.findOne({
          userId: user._id,
          expiresAt: { $gt: new Date() },
        })
        if (!existingSession) throw new Error('No active session found')
        const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        await sessionsCollection.updateOne(
          { _id: existingSession._id },
          { $set: { expiresAt: newExpiresAt, updatedAt: new Date() } },
        )
        const newAccessToken = this.generateToken({
          userId: user._id.toString(),
          email: user.email,
          role: user.role,
        })
        const updatedSession = await sessionsCollection.findOne({
          _id: existingSession._id,
        })
        return { user, session: updatedSession!, accessToken: newAccessToken }
      } catch {
        throw new Error('Failed to refresh session')
      }
    }

    async verifyAuthToken(token: string): Promise<AuthTokenPayload> {
      await initializeDependencies()
      try {
        return this.verifyToken(token) as AuthTokenPayload
      } catch {
        throw new Error('Invalid token')
      }
    }

    async getUserById(userId: string): Promise<User | null> {
      await initializeDependencies()
      if (!mongodb) throw new Error('MongoDB not available')
      const db = await mongodb.connect()
      const usersCollection = db.collection<User>('users')
      if (!ObjectId) throw new Error('ObjectId is not available')
      return await usersCollection.findOne({ _id: new ObjectId(userId) })
    }

    async findUserByEmail(email: string): Promise<User | null> {
      await initializeDependencies()
      if (!mongodb) throw new Error('MongoDB not available')
      const db = await mongodb.connect()
      const usersCollection = db.collection<User>('users')
      // Email is expected to be indexed and unique in the users collection.
      return await usersCollection.findOne({ email })
    }

    async updateUser(
      userId: string,
      updates: Partial<User>,
    ): Promise<User | null> {
      await initializeDependencies()
      if (!mongodb)
        throw new Error(
          'MongoDB not initialized in updateUser; dependencies missing or not loaded.',
        )
      const db = await mongodb.connect()
      const usersCollection = db.collection<User>('users')
      if (!ObjectId) throw new Error('ObjectId is not available')
      await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { ...updates, updatedAt: new Date() } },
      )
      return await usersCollection.findOne({ _id: new ObjectId(userId) })
    }

    async changePassword(userId: string, newPassword: string): Promise<void> {
      await initializeDependencies()
      if (!mongodb || !bcrypt)
        throw new Error('MongoDB or bcrypt not available')
      const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS)
      const db = await mongodb.connect()
      const usersCollection = db.collection<User>('users')
      if (!ObjectId) throw new Error('ObjectId is not available')
      await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { password: hashedPassword, updatedAt: new Date() } },
      )
    }

    async signIn(email: string, password: string): Promise<AuthResult> {
      await initializeDependencies()
      if (!mongodb || !bcrypt)
        throw new Error('MongoDB or bcrypt not available')
      const db = await mongodb.connect()
      const usersCollection = db.collection<User>('users')

      // Find user by email
      const user = await usersCollection.findOne({ email })
      if (!user) throw new Error('Invalid credentials')

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password)
      if (!isValidPassword) throw new Error('Invalid credentials')

      // Update last login
      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { lastLogin: new Date(), updatedAt: new Date() } },
      )

      // Create session
      const sessionsCollection = db.collection<Session>('sessions')
      const sessionId = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      const session: Omit<Session, '_id'> = {
        sessionId,
        userId: user._id,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      await sessionsCollection.insertOne(session as Session)

      // Generate access token
      const accessToken = this.generateToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      })

      return {
        user,
        session: { ...session, _id: (session as any)._id } as Session,
        accessToken,
      }
    }

    private generateToken(payload: AuthTokenPayload): string {
      if (!jwt) throw new Error('JWT not available')
      return jwt.sign(payload, this.JWT_SECRET, { expiresIn: '1h' })
    }

    private verifyToken(token: string): AuthTokenPayload {
      if (!jwt) throw new Error('JWT not available')
      return jwt.verify(token, this.JWT_SECRET) as AuthTokenPayload
    }
  }
  mongoAuthService = new (MongoAuthServiceImpl as any)()
}

if (typeof window !== 'undefined') {
  MongoAuthServiceImpl = function () {
    throw new Error('MongoAuthService is not available on the client')
  }
  mongoAuthService = undefined
}

export { MongoAuthServiceImpl as MongoAuthService, mongoAuthService }
