/**
 * Enhanced type definitions for the application with strict typing
 */

import type { StrictRequired, Brand } from './utility'

// ============================================================================
// BRANDED TYPES FOR TYPE SAFETY
// ============================================================================

/** Branded string types for enhanced type safety */
export type UserId = Brand<string, 'UserId'>
export type SessionId = Brand<string, 'SessionId'>
export type ComponentId = Brand<string, 'ComponentId'>
export type RouteSlug = Brand<string, 'RouteSlug'>

// ============================================================================
// LAYOUT TYPES
// ============================================================================

/** Background types for the layout with strict enum */
export type BgType =
  | 'default'
  | 'plum'
  | 'gradient'
  | 'pulse'
  | 'light'
  | 'dark'
  | 'stars'
  | 'dot'
  | 'rose'
  | 'particle'
  | 'animated'

/** Strict validation for background types */
export const isBgType = (value: string): value is BgType => {
  const validTypes: readonly BgType[] = [
    'default',
    'plum',
    'gradient',
    'pulse',
    'light',
    'dark',
    'stars',
    'dot',
    'rose',
    'particle',
    'animated',
  ] as const
  return validTypes.includes(value as BgType)
}

// ============================================================================
// NAVIGATION TYPES
// ============================================================================

/** Enhanced navigation bar layout with strict typing */
export type NavBarLayout = StrictRequired<{
  left: readonly NavItem[]
  right: readonly NavItem[]
  mergeOnMobile: boolean
}>

/** Strict navigation item definition */
export type NavItem = {
  name: string
  link: string
  icon: string | null
  desc: string | null
  isExternal: boolean
  ariaLabel: string
}

/** Navigation item creation helper with defaults */
export type NavItemInput = {
  name: string
  link: string
  icon?: string
  desc?: string
  isExternal?: boolean
  ariaLabel?: string
}

/** Helper function to create properly typed navigation items */
export const createNavItem = (input: NavItemInput): NavItem => ({
  name: input.name,
  link: input.link,
  icon: input.icon || null,
  desc: input.desc || null,
  isExternal: input.isExternal ?? false,
  ariaLabel: input.ariaLabel ?? input.name,
})

// ============================================================================
// COMPONENT PROPS TYPES
// ============================================================================

/** Base props that all components should accept */
export type BaseComponentProps = {
  readonly 'id'?: ComponentId
  readonly 'className'?: string
  readonly 'data-testid'?: string
  readonly 'aria-label'?: string
}

/** Props for components that can be disabled */
export type DisableableProps = {
  readonly 'disabled'?: boolean
  readonly 'aria-disabled'?: boolean
}

/** Props for components with loading states */
export type LoadingProps = {
  readonly 'loading'?: boolean
  readonly 'aria-busy'?: boolean
}

/** Combined interactive component props */
export type InteractiveComponentProps = BaseComponentProps &
  DisableableProps &
  LoadingProps

// ============================================================================
// RESPONSIVE DESIGN TYPES
// ============================================================================

/** Strict breakpoint definitions */
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

/** Responsive value type for properties that can vary by breakpoint */
export type ResponsiveValue<T> = T | Partial<Record<Breakpoint, T>>

/** Helper to create responsive values */
export const createResponsiveValue = <T>(
  defaultValue: T,
  breakpointValues?: Partial<Record<Breakpoint, T>>,
): ResponsiveValue<T> => {
  if (!breakpointValues) {
    return defaultValue
  }
  return { ...breakpointValues }
}

// ============================================================================
// ACCESSIBILITY TYPES
// ============================================================================

/** ARIA role definitions with strict typing */
export type AriaRole =
  | 'button'
  | 'link'
  | 'menu'
  | 'menuitem'
  | 'menubar'
  | 'navigation'
  | 'main'
  | 'banner'
  | 'contentinfo'
  | 'complementary'
  | 'search'
  | 'form'
  | 'dialog'
  | 'alert'
  | 'alertdialog'
  | 'status'
  | 'log'

/** Accessibility props for interactive elements */
export type AccessibilityProps = {
  readonly 'role'?: AriaRole
  readonly 'aria-label'?: string
  readonly 'aria-labelledby'?: string
  readonly 'aria-describedby'?: string
  readonly 'aria-expanded'?: boolean
  readonly 'aria-haspopup'?:
    | boolean
    | 'menu'
    | 'listbox'
    | 'tree'
    | 'grid'
    | 'dialog'
  readonly 'aria-hidden'?: boolean
  readonly 'tabIndex'?: number
}

// ============================================================================
// THEME TYPES
// ============================================================================

/** Strict theme mode definition */
export type ThemeMode = 'light' | 'dark' | 'system'

/** Color scheme with strict typing */
export type ColorScheme = 'light' | 'dark'

/** Theme configuration */
export type ThemeConfig = StrictRequired<{
  mode: ThemeMode
  colorScheme: ColorScheme
  highContrast: boolean
  reducedMotion: boolean
}>

// ============================================================================
// TYPE COMPATIBILITY & LEGACY SUPPORT
// ============================================================================

/** For backward compatibility - will be deprecated */
export type InternalNav = NavItem
export type SocialLink = NavItem

// ============================================================================
// RE-EXPORTS
// ============================================================================

// Enhanced utility types
export * from './utility'

// Domain-specific types
export * from './auth'
export * from './chat'
export * from './user'
export * from './analytics'
export * from './treatment'

// ============================================================================
// TYPE GUARDS
// ============================================================================

/** Type guard for navigation items */
export const isNavItem = (value: unknown): value is NavItem => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const item = value as Record<string, unknown>

  return (
    typeof item['name'] === 'string' &&
    typeof item['link'] === 'string' &&
    (item['icon'] === null || typeof item['icon'] === 'string') &&
    (item['desc'] === null || typeof item['desc'] === 'string') &&
    typeof item['isExternal'] === 'boolean' &&
    typeof item['ariaLabel'] === 'string'
  )
}

/** Type guard for theme mode */
export const isThemeMode = (value: string): value is ThemeMode => {
  return ['light', 'dark', 'system'].includes(value)
}

/** Type guard for breakpoint */
export const isBreakpoint = (value: string): value is Breakpoint => {
  return ['xs', 'sm', 'md', 'lg', 'xl', '2xl'].includes(value)
}
