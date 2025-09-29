/**
 * Thin adapter between Better-Auth helpers and the in-repo MongoAuthService.
 *
 * Delegates runtime calls to the server-side `mongoAuthService` exported
 * from `src/services/mongoAuth.service.ts`.
 */
import type { User as MongoUser } from '@/services/mongodb.types'
import { mongoAuthService } from '@/services/mongoAuth.service'

export interface AuthInfo {
    userId: string
    role: string
    session?: string
}

interface MongoAuthServiceShape {
    verifyAuthToken?: (token: string) => Promise<{ userId: string; role: string; session?: string }>
    getUserById?: (id: string) => Promise<MongoUser | null>
    createUser?: (email: string, password: string, role?: string) => Promise<MongoUser>
    signIn?: (email: string, password: string) => Promise<{ user: MongoUser; token: string }>
    signOut?: (sessionId: string) => Promise<void>
    refreshSession?: (token: string) => Promise<{ user: MongoUser; session: unknown; accessToken: string }>
    updateUser?: (id: string, updates: Record<string, unknown>) => Promise<MongoUser | null>
    verifyOAuthCode?: (code: string) => Promise<{ user: MongoUser; token: string }>
    findUserByEmail?: (email: string) => Promise<MongoUser | null>
    changePassword?: (userId: string, newPassword: string) => Promise<void>
}

function ensureService(): MongoAuthServiceShape {
    if (!mongoAuthService) throw new Error('mongoAuthService is not available at runtime')
    return mongoAuthService as unknown as MongoAuthServiceShape
}

export async function verifyToken(token: string): Promise<AuthInfo> {
    const svc = ensureService()
    if (!svc.verifyAuthToken) {
        throw new Error('mongoAuthService.verifyAuthToken not available')
    }
    const payload = await svc.verifyAuthToken(token)
    return {
        userId: payload.userId,
        role: payload.role,
        session: payload.session ?? token,
    }
}

export async function getUserById(userId: string): Promise<MongoUser | null> {
    const svc = ensureService()
    if (!svc.getUserById) return null
    return await svc.getUserById(userId)
}

export async function createUser(opts: { email: string; password: string; role?: string }) {
    const svc = ensureService()
    if (!svc.createUser) {
        throw new Error('mongoAuthService.createUser not available')
    }
    return await svc.createUser(opts.email, opts.password, opts.role ?? 'user')
}

export async function revokeToken(sessionId: string): Promise<void> {
    const svc = ensureService()
    if (!svc.signOut) return
    await svc.signOut(sessionId)
}

export async function refreshToken(token: string) {
    const svc = ensureService()
    if (!svc.refreshSession) {
        throw new Error('mongoAuthService.refreshSession not available')
    }
    return await svc.refreshSession(token)
}

export async function findUserByEmail(_email: string) {
    const svc = ensureService()
    if (!svc.findUserByEmail) {
        throw new Error('mongoAuthService.findUserByEmail not available')
    }
    return await svc.findUserByEmail(_email)
}

export async function signIn(email: string, password: string) {
    const svc = ensureService()
    if (!svc.signIn) {
        throw new Error('mongoAuthService.signIn not available')
    }
    return await svc.signIn(email, password)
}

export async function updateUser(userId: string, updates: Record<string, unknown>) {
    const svc = ensureService()
    if (!svc.updateUser) {
        throw new Error('mongoAuthService.updateUser not available')
    }
    return await svc.updateUser(userId, updates)
}

export async function verifyOAuthCode(code: string) {
    const svc = ensureService()
    if (!svc.verifyOAuthCode) {
        throw new Error('mongoAuthService.verifyOAuthCode not available')
    }
    return await svc.verifyOAuthCode(code)
}

export default {
    verifyToken,
    getUserById,
    createUser,
    revokeToken,
    refreshToken,
    findUserByEmail,
    signIn,
    updateUser,
    verifyOAuthCode,
}
