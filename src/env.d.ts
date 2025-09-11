/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    requestId: string
    timestamp: string
    user?: {
      id: string
      email: string
      name?: string
    }
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
