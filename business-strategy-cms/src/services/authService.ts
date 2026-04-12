import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { JwtPayload as JwtClaims } from 'jsonwebtoken'

import { redisClient } from '@/config/database'
import { UserModel } from '@/models/User'
import {
  User,
  UserCredentials,
  UserRegistration,
  AuthTokens,
  JwtPayload,
  UserRole,
} from '@/types/user'

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'your-super-secret-jwt-key'
const JWT_REFRESH_SECRET =
  process.env['JWT_REFRESH_SECRET'] ?? 'your-super-secret-refresh-key'

const USER_ROLES = new Set<string>(Object.values(UserRole))

const isUserRole = (value: unknown): value is UserRole =>
  typeof value === 'string' && USER_ROLES.has(value)

const parseDurationToSeconds = (value: string, fallback: number): number => {
  const match = /^(\d+)(ms|s|m|h|d|w)?$/.exec(value.trim())
  if (!match) {
    return fallback
  }

  const amountText = match[1]
  if (!amountText) {
    return fallback
  }

  const amount = Number.parseInt(amountText, 10)
  const unit = match[2] ?? 's'

  switch (unit) {
    case 'ms':
      return Math.max(1, Math.floor(amount / 1000))
    case 's':
      return amount
    case 'm':
      return amount * 60
    case 'h':
      return amount * 60 * 60
    case 'd':
      return amount * 24 * 60 * 60
    case 'w':
      return amount * 7 * 24 * 60 * 60
    default:
      return fallback
  }
}

const isJwtPayload = (value: string | JwtClaims): value is JwtPayload =>
  typeof value !== 'string' &&
  typeof value['userId'] === 'string' &&
  typeof value['email'] === 'string' &&
  isUserRole(value['role'])

const verifyJwtPayload = (token: string, secret: string): JwtPayload => {
  const decoded = jwt.verify(token, secret)
  if (!isJwtPayload(decoded)) {
    throw new Error('Invalid JWT payload')
  }

  return decoded
}

const JWT_EXPIRES_IN = parseDurationToSeconds(
  process.env['JWT_EXPIRES_IN'] ?? '15m',
  15 * 60,
)
const JWT_REFRESH_EXPIRES_IN = parseDurationToSeconds(
  process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d',
  7 * 24 * 60 * 60,
)
const BCRYPT_ROUNDS = Number.parseInt(process.env['BCRYPT_ROUNDS'] ?? '12', 10)

export class AuthService {
  public static generateTokens(payload: JwtPayload): AuthTokens {
    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    })
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
    })

    return {
      accessToken,
      refreshToken,
      expiresIn: JWT_EXPIRES_IN * 1000,
    }
  }

  static async register(
    userData: UserRegistration,
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const existingUser = await UserModel.findByEmail(userData.email)
    if (existingUser) {
      throw new Error('User already exists with this email')
    }

    const existingUsername = await UserModel.findByUsername(userData.username)
    if (existingUsername) {
      throw new Error('Username already taken')
    }

    const hashedPassword = await bcrypt.hash(userData.password, BCRYPT_ROUNDS)

    const user = await UserModel.create({
      email: userData.email,
      username: userData.username,
      firstName: userData.firstName,
      lastName: userData.lastName,
      password: hashedPassword,
      role: userData.role ?? UserRole.VIEWER,
      isActive: true,
      isEmailVerified: false,
    })

    const payload: JwtPayload = {
      userId: user.id!,
      email: user.email,
      role: user.role,
    }

    const tokens = this.generateTokens(payload)

    await redisClient.setEx(
      `refresh_token:${user.id!}`,
      7 * 24 * 60 * 60,
      tokens.refreshToken,
    )

    const { password: _password, ...userWithoutPassword } = user
    return { user: userWithoutPassword as User, tokens }
  }

  static async login(
    credentials: UserCredentials,
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const user = await UserModel.findByEmail(credentials.email)
    if (!user) {
      throw new Error('Invalid credentials')
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated')
    }

    if (!user.password) {
      throw new Error('Invalid credentials')
    }
    const isPasswordValid = await bcrypt.compare(
      credentials.password,
      user.password,
    )
    if (!isPasswordValid) {
      throw new Error('Invalid credentials')
    }

    await UserModel.update(user.id!, { lastLoginAt: new Date() })

    const payload: JwtPayload = {
      userId: user.id!,
      email: user.email,
      role: user.role,
    }

    const tokens = this.generateTokens(payload)

    await redisClient.setEx(
      `refresh_token:${user.id!}`,
      7 * 24 * 60 * 60,
      tokens.refreshToken,
    )

    const { password: _password, ...userWithoutPassword } = user
    return { user: userWithoutPassword as User, tokens }
  }

  static async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = verifyJwtPayload(refreshToken, JWT_REFRESH_SECRET)

      const storedToken = await redisClient.get(
        `refresh_token:${payload.userId}`,
      )
      if (!storedToken || storedToken !== refreshToken) {
        throw new Error('Invalid refresh token')
      }

      const user = await UserModel.findById(payload.userId)
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive')
      }

      const newPayload: JwtPayload = {
        userId: user.id!,
        email: user.email,
        role: user.role,
      }

      const tokens = this.generateTokens(newPayload)

      await redisClient.setEx(
        `refresh_token:${user.id!}`,
        7 * 24 * 60 * 60,
        tokens.refreshToken,
      )

      return tokens
    } catch {
      throw new Error('Invalid refresh token')
    }
  }

  static async logout(userId: string, _refreshToken?: string): Promise<void> {
    await redisClient.del(`refresh_token:${userId}`)
  }

  static async verifyToken(token: string): Promise<JwtPayload | null> {
    try {
      const isBlacklisted = await redisClient.get(`blacklist:${token}`)
      if (isBlacklisted) {
        return null
      }

      const payload = verifyJwtPayload(token, JWT_SECRET)

      const user = await UserModel.findById(payload.userId)
      if (!user || !user.isActive) {
        return null
      }

      return {
        userId: user.id!,
        email: user.email,
        role: user.role,
      }
    } catch {
      return null
    }
  }

  static async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await UserModel.findById(userId)
    if (!user) {
      throw new Error('User not found')
    }

    if (!user.password) {
      throw new Error('Password not set for this user')
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password)
    if (!isOldPasswordValid) {
      throw new Error('Invalid current password')
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)

    await UserModel.update(userId, { password: hashedNewPassword })
    await redisClient.del(`refresh_token:${userId}`)
  }

  static async resetPassword(
    email: string,
    newPassword: string,
  ): Promise<void> {
    const user = await UserModel.findByEmail(email)
    if (!user) {
      throw new Error('User not found')
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)

    await UserModel.update(user.id!, { password: hashedNewPassword })
    await redisClient.del(`refresh_token:${user.id!}`)
  }
}
