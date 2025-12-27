import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import {
  User,
  UserCredentials,
  UserRegistration,
  AuthTokens,
  JwtPayload,
  UserRole,
} from '@/types/user'
import { UserModel } from '@/models/User'
import { redisClient } from '@/config/database'

const JWT_SECRET = process.env['JWT_SECRET'] || 'your-super-secret-jwt-key'
const JWT_REFRESH_SECRET =
  process.env['JWT_REFRESH_SECRET'] || 'your-super-secret-refresh-key'
const JWT_EXPIRES_IN = process.env['JWT_EXPIRES_IN'] || '15m'
const JWT_REFRESH_EXPIRES_IN = process.env['JWT_REFRESH_EXPIRES_IN'] || '7d'

export class AuthService {
  private static generateTokens(payload: JwtPayload): AuthTokens {
    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN as string,
    })
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRES_IN as string,
    })

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60 * 1000, // 15 minutes in milliseconds
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

    const saltRounds = parseInt(process.env['BCRYPT_ROUNDS'] || '12')
    const hashedPassword = await bcrypt.hash(userData.password, saltRounds)

    const user = await UserModel.create({
      email: userData.email,
      username: userData.username,
      firstName: userData.firstName,
      lastName: userData.lastName,
      password: hashedPassword,
      role: UserRole.VIEWER,
      isActive: true,
      isEmailVerified: false,
    })

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    }

    const tokens = this.generateTokens(payload)

    await redisClient.setEx(
      `refresh_token:${user.id}`,
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

    await UserModel.update(user.id, { lastLoginAt: new Date() })

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    }

    const tokens = this.generateTokens(payload)

    await redisClient.setEx(
      `refresh_token:${user.id}`,
      7 * 24 * 60 * 60,
      tokens.refreshToken,
    )

    const { password: _password, ...userWithoutPassword } = user
    return { user: userWithoutPassword as User, tokens }
  }

  static async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JwtPayload

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
        userId: user.id,
        email: user.email,
        role: user.role,
      }

      const tokens = this.generateTokens(newPayload)

      await redisClient.setEx(
        `refresh_token:${user.id}`,
        7 * 24 * 60 * 60,
        tokens.refreshToken,
      )

      return tokens
    } catch (error) {
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

      const payload = jwt.verify(token, JWT_SECRET) as JwtPayload

      const user = await UserModel.findById(payload.userId)
      if (!user || !user.isActive) {
        return null
      }

      return {
        userId: user.id,
        email: user.email,
        role: user.role,
      }
    } catch (error) {
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

    const saltRounds = parseInt(process.env['BCRYPT_ROUNDS'] || '12')
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds)

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

    const saltRounds = parseInt(process.env['BCRYPT_ROUNDS'] || '12')
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds)

    await UserModel.update(user.id, { password: hashedNewPassword })
    await redisClient.del(`refresh_token:${user.id}`)
  }
}
