/// <reference types="astro/client" />

import '../.astro/types.d.ts'

declare namespace App {
  interface Locals {
    requestId?: string
    timestamp?: string
    user?: {
      id: string
      email: string
      name?: string
      role?: string
    } | null
    session?: {
      _id?: any
      userId?: any
      sessionId?: string
      expiresAt?: Date
      createdAt?: Date
      updatedAt?: Date
    } | null
    vercelEdge?: {
      country: string
      region: string
      ip: string
      isAuthPage: boolean
      userAgent: string
    }
    cspNonce?: string
  }
}
