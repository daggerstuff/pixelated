export interface User {
  id?: string
  email: string
  username: string
  firstName: string
  lastName: string
  password?: string // Optional for responses
  role: UserRole
  isActive: boolean
  isEmailVerified: boolean
  lastLoginAt?: Date
  createdAt: Date
  updatedAt: Date
}

export enum UserRole {
  ADMINISTRATOR = 'Administrator',
  CONTENT_CREATOR = 'Content_Creator',
  EDITOR = 'Editor',
  VIEWER = 'Viewer',
}

export interface UserCredentials {
  email: string
  password: string
}

export interface UserRegistration {
  email: string
  username: string
  firstName: string
  lastName: string
  password: string
  role?: UserRole
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface JwtPayload {
  userId: string
  email: string
  role: UserRole
  iat?: number
  exp?: number
}
