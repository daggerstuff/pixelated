/// <reference types="astro/client" />

import '../.astro/types.d.ts'

declare namespace App {
  interface Locals {
    requestId: string
    timestamp: string
    user: {
      id: string
      email: string
      emailVerified: boolean
      role: string
      fullName?: string
      avatarUrl?: string
      createdAt?: string
      updatedAt?: string
      lastLogin?: string
      appMetadata?: Record<string, unknown>
      userMetadata?: Record<string, unknown>
    } | null
    session: {
      id: string
      userId: string
      expiresAt: Date
    } | null
    vercelEdge?: {
      country: string
      region: string
      ip: string
      isAuthPage: boolean
      userAgent: string
    }
    cspNonce?: string
    isSSR?: boolean
    isPrerendered?: boolean
    headers?: Record<string, string>
    userPreferences?: {
      darkMode: boolean
      language: string
      userAgent: string
      isMobile: boolean
      reducedMotion: boolean
      isIOS: boolean
      isAndroid: boolean
      ip: string
    }
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_AUTH0_DOMAIN: string;
  readonly PUBLIC_AUTH0_CLIENT_ID: string;
  readonly GRAFANA_URL: string;
  readonly GRAFANA_API_KEY: string;
  readonly GRAFANA_ORG_ID: string;
  readonly SLACK_WEBHOOK: string;
  readonly MONITORING_EMAIL_RECIPIENTS: string;
  readonly APP_VERSION: string;
  readonly PUBLIC_TRAINING_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface NetworkInformation extends EventTarget {
  readonly effectiveType: string;
  readonly rtt: number;
  readonly downlink: number;
  readonly saveData: boolean;
  onchange: ((this: NetworkInformation, ev: Event) => any) | null;
}

interface Navigator {
  readonly connection?: NetworkInformation;
}
