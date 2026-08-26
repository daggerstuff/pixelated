// Astro component type declarations
// Note: The generic 'declare module "*.astro"' lives in .astro-env.d.ts
// Do NOT duplicate it here — conflicting ambient declarations cause "no default export" errors.

// Type module declarations for missing local modules
declare module '@/types/patient' {
  export interface Patient {
    id: string
    name: string
    dateOfBirth?: string
    medicalRecordNumber?: string
  }
}

declare module '@/lib/analytics/service' {
  export class AnalyticsService {
    track(event: string, data?: unknown): void
    getMetrics(): Promise<unknown>
  }
}

declare module '../../config/azure.config' {
  export interface AzureConfig {
    clientId: string
    tenantId: string
    clientSecret: string
  }
  export const azureConfig: AzureConfig
}

declare module '../config/azure.config' {
  export interface AzureConfig {
    clientId: string
    tenantId: string
    clientSecret: string
  }
  export const azureConfig: AzureConfig
}

declare module '@/config/azure.config' {
  export interface AzureConfig {
    clientId: string
    tenantId: string
    clientSecret: string
  }
  export const azureConfig: AzureConfig
}

declare module './objectives' {
  export interface Objective {
    id: string
    title: string
    description: string
  }
}

declare module '../types/index.ts' {
  export * from '../../types/audit'
  export * from '../../types/collaboration'
  export * from '../../types/deployment'
  export * from '../../types/monitoring'
}

declare module '../../simulator/types' {
  export interface SimulationConfig {
    mode: string
    userCount: number
  }
}

declare module '../../types/audit' {
  export enum AuditEventType {
    LOGIN = 'login',
    LOGOUT = 'logout',
  }
  export interface AuditEvent {
    id: string
    eventType: AuditEventType
    timestamp: Date
  }
}

// UI component declarations
declare module './input' {
  export interface InputProps {
    type?: string
    value?: string
    onChange?: (e: unknown) => void
  }
  const Input: unknown
  export { Input }
}

declare module './label' {
  export interface LabelProps {
    htmlFor?: string
    children?: unknown
  }
  const Label: unknown
  export { Label }
}

declare module './select' {
  export interface SelectProps {
    value?: string
    onChange?: (value: string) => void
  }
  const Select: unknown
  export { Select }
}

declare module './textarea' {
  export interface TextareaProps {
    value?: string
    onChange?: (e: unknown) => void
  }
  const Textarea: unknown
  export { Textarea }
}
