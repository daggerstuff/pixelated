import 'astro'

declare module 'astro' {
  interface Locals {
    isSSR: boolean
    isPrerendered: boolean
    headers: Record<string, string>
    userPreferences: {
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
