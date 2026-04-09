// Astro component type declarations
declare module '*.astro' {
  export type AstroComponentFactory = (options: {
    props: Record<string, unknown>
    slots: Record<string, () => Promise<unknown>>
  }) => Promise<unknown>
  const component: AstroComponentFactory
  export default component
}

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

// Generic Astro component declarations for missing components
declare module '../SearchDemo.astro' {
  const SearchDemo: unknown
  export default SearchDemo
}

declare module '../ErrorBoundary.astro' {
  const ErrorBoundary: unknown
  export default ErrorBoundary
}

declare module './Footer.astro' {
  const Footer: unknown
  export default Footer
}

declare module '../Alert.astro' {
  const Alert: unknown
  export default Alert
}

declare module '../Button.astro' {
  const Button: unknown
  export default Button
}

declare module '../Card.astro' {
  const Card: unknown
  export default Card
}

declare module '../CardAction.astro' {
  const CardAction: unknown
  export default CardAction
}

declare module '../CardContent.astro' {
  const CardContent: unknown
  export default CardContent
}

declare module '../CardDescription.astro' {
  const CardDescription: unknown
  export default CardDescription
}

declare module '../CardFooter.astro' {
  const CardFooter: unknown
  export default CardFooter
}

declare module '../CardHeader.astro' {
  const CardHeader: unknown
  export default CardHeader
}

declare module '../CardTitle.astro' {
  const CardTitle: unknown
  export default CardTitle
}

declare module '../ThemeToggle.astro' {
  const ThemeToggle: unknown
  export default ThemeToggle
}

declare module '../DashboardLayout.astro' {
  const DashboardLayout: unknown
  export default DashboardLayout
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
