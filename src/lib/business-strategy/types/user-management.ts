/**
 * User Management Types for Business Strategy System
 */

import type { BaseEntity, UserId } from './common'

export type Role =
    | 'administrator'
    | 'content_creator'
    | 'editor'
    | 'viewer'
    | 'analyst'
    | 'manager'

export interface Permission {
    resource: string // document, user, workflow, analytics, etc.
    action: 'create' | 'read' | 'update' | 'delete' | 'approve' | 'share' | 'export'
    conditions?: PermissionCondition[]
}

export interface PermissionCondition {
    field: string
    operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'starts_with'
    value: unknown
}

export interface NotificationSettings {
    email: {
        enabled: boolean
        frequency: 'immediate' | 'daily' | 'weekly' | 'never'
        types: string[]
    }
    inApp: {
        enabled: boolean
        types: string[]
    }
    slack?: {
        enabled: boolean
        webhook?: string
        types: string[]
    }
}

export interface EditorSettings {
    theme: 'light' | 'dark' | 'auto'
    fontSize: number
    fontFamily: string
    lineHeight: number
    wordWrap: boolean
    showLineNumbers: boolean
    autoSave: boolean
    autoSaveInterval: number // seconds
    spellCheck: boolean
    grammar: boolean
}

export interface DashboardSettings {
    layout: 'grid' | 'list' | 'cards'
    itemsPerPage: number
    defaultView: 'recent' | 'favorites' | 'assigned' | 'all'
    showAnalytics: boolean
    showNotifications: boolean
    compactMode: boolean
    widgets: {
        id: string
        enabled: boolean
        position: { x: number; y: number }
        size: { width: number; height: number }
    }[]
}

export interface UserPreferences {
    theme: 'light' | 'dark' | 'auto'
    language: string
    timezone: string
    dateFormat: string
    timeFormat: '12h' | '24h'
    notifications: NotificationSettings
    editor: EditorSettings
    dashboard: DashboardSettings
    privacy: {
        showOnlineStatus: boolean
        showActivity: boolean
        allowMentions: boolean
    }
}

export interface UserActivity {
    id: string
    userId: UserId
    type: 'login' | 'logout' | 'document_view' | 'document_edit' | 'comment' | 'approval'
    entityType?: string
    entityId?: string
    description: string
    metadata?: Record<string, unknown>
    timestamp: Date
    ipAddress?: string
    userAgent?: string
    location?: {
        country?: string
        city?: string
        coordinates?: [number, number]
    }
}

export interface UserSession {
    id: string
    userId: UserId
    token: string
    refreshToken?: string
    deviceId?: string
    deviceName?: string
    deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown'
    browser?: string
    os?: string
    ipAddress: string
    location?: {
        country?: string
        city?: string
    }
    createdAt: Date
    lastActiveAt: Date
    expiresAt: Date
    isActive: boolean
}

export interface UserInvitation {
    id: string
    email: string
    role: Role
    permissions?: Permission[]
    invitedBy: UserId
    invitedAt: Date
    expiresAt: Date
    acceptedAt?: Date
    token: string
    message?: string
    status: 'pending' | 'accepted' | 'expired' | 'revoked'
}

export interface User extends BaseEntity {
    email: string
    name: string
    firstName?: string
    lastName?: string
    avatar?: string
    bio?: string
    title?: string
    department?: string
    location?: string

    // Authentication
    role: Role
    permissions: Permission[]
    isActive: boolean
    isVerified: boolean

    // Preferences
    preferences: UserPreferences

    // Security
    lastLogin?: Date
    lastPasswordChange?: Date
    failedLoginAttempts: number
    lockedUntil?: Date
    twoFactorEnabled: boolean

    // Onboarding
    onboardingCompleted: boolean
    onboardingStep?: string

    // Social
    socialLinks?: {
        linkedin?: string
        twitter?: string
        github?: string
        website?: string
    }

    // Analytics
    analytics: {
        documentsCreated: number
        documentsEdited: number
        commentsPosted: number
        approvalsGiven: number
        loginCount: number
        totalTimeSpent: number // minutes
        lastActivity?: Date
    }

    // Notifications
    unreadNotifications: number

    // Team
    teams?: string[]
    managerId?: UserId
    directReports?: UserId[]
}

export interface Team extends BaseEntity {
    name: string
    description?: string
    type: 'department' | 'project' | 'working-group' | 'committee'
    managerId: UserId
    members: {
        userId: UserId
        role: 'manager' | 'member' | 'contributor'
        joinedAt: Date
        addedBy: UserId
    }[]
    permissions: Permission[]
    settings: {
        isPublic: boolean
        allowSelfJoin: boolean
        requireApproval: boolean
    }
    analytics: {
        memberCount: number
        documentsCreated: number
        collaborationScore: number // 0-100
    }
}

export interface AuthResult {
    success: boolean
    user?: User
    token?: string
    refreshToken?: string
    expiresAt?: Date
    error?: {
        code: string
        message: string
    }
    requiresTwoFactor?: boolean
    twoFactorToken?: string
}

export interface Credentials {
    email: string
    password: string
    twoFactorCode?: string
    rememberMe?: boolean
}

export interface PasswordResetRequest {
    id: string
    email: string
    token: string
    requestedAt: Date
    expiresAt: Date
    usedAt?: Date
    ipAddress: string
    userAgent?: string
}

export interface UserNotification {
    id: string
    userId: UserId
    type: 'document' | 'workflow' | 'comment' | 'mention' | 'system' | 'security'
    title: string
    message: string
    data?: Record<string, unknown>
    read: boolean
    readAt?: Date
    createdAt: Date
    expiresAt?: Date
    priority: 'low' | 'medium' | 'high' | 'urgent'
    actions?: {
        label: string
        action: string
        url?: string
    }[]
}

export interface AuditEvent {
    id: string
    userId?: UserId
    type: 'authentication' | 'authorization' | 'data_access' | 'data_modification' | 'system'
    action: string
    resource?: string
    resourceId?: string
    result: 'success' | 'failure' | 'error'
    details?: Record<string, unknown>
    timestamp: Date
    ipAddress?: string
    userAgent?: string
    sessionId?: string
    riskScore?: number // 0-100
}