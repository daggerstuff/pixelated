/// <reference types="astro/client" />

import '../.astro/types.d.ts'

declare namespace App {
  interface Locals {
    requestId: string
    timestamp: string
    user: import('better-auth').User | null
    session: import('better-auth').Session | null
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

interface ImportMetaEnv {
  readonly PUBLIC_AUTH0_DOMAIN: string;
  readonly PUBLIC_AUTH0_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
