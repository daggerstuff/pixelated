/// <reference types="astro/client" />
/// <reference types="vitest/globals" />

import './src/env.d.ts'

// Override Vite's ImportMetaEnv to avoid index signature issues
// Vite's types use Record<ImportMetaEnvFallbackKey, any> which creates an index signature
// that causes TS4111 errors when using dot notation on explicitly declared properties
declare module 'vite/client' {
  interface ImportMetaEnv {
    // Auth0
    readonly PUBLIC_AUTH0_DOMAIN?: string
    readonly PUBLIC_AUTH0_CLIENT_ID?: string
    readonly PUBLIC_AUTH0_AUDIENCE?: string
    readonly AUTH0_DOMAIN?: string
    readonly AUTH0_CLIENT_ID?: string
    readonly AUTH0_CLIENT_SECRET?: string
    readonly AUTH0_AUDIENCE?: string
    readonly VITE_AUTH0_DOMAIN?: string
    readonly VITE_AUTH0_CLIENT_ID?: string
    readonly VITE_AUTH0_AUDIENCE?: string
    // API URLs
    readonly API_BASE_URL?: string
    readonly PUBLIC_JOURNAL_RESEARCH_API_URL?: string
    readonly PUBLIC_ANALYTICS_ENDPOINT?: string
    readonly PUBLIC_ACADEMIC_API_URL?: string
    readonly PUBLIC_THERAPEUTIC_API_URL?: string
    readonly PUBLIC_TRAINING_WS_URL?: string
    readonly PUBLIC_RYBBIT_SCRIPT_URL?: string
    readonly PUBLIC_RYBBIT_SITE_ID?: string
    readonly PUBLIC_ANALYTICS_API_KEY?: string
    readonly EMBEDDING_AGENT_URL?: string
    readonly CORS_ORIGIN?: string
    // Database & Auth
    readonly MONGODB_URI?: string
    readonly JWT_SECRET?: string
    readonly JWT_AUDIENCE?: string
    readonly JWT_ISSUER?: string
    // Tracing
    readonly TRACING_SERVICE_NAME?: string
    readonly TRACING_SERVICE_VERSION?: string
    readonly TRACING_EXPORTER_ENDPOINT?: string
    readonly TRACING_SAMPLING_RATIO?: string
    readonly TRACING_EXPORTER_HEADERS?: string
    // Monitoring
    readonly GRAFANA_URL?: string
    readonly GRAFANA_API_KEY?: string
    readonly GRAFANA_ORG_ID?: string
    readonly SLACK_WEBHOOK?: string
    readonly MONITORING_EMAIL_RECIPIENTS?: string
    readonly APP_VERSION?: string
    // Vite built-ins
    readonly PROD: boolean
    readonly DEV: boolean
    readonly MODE: string
    readonly SSR: boolean
    readonly BASE_URL: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

declare module 'astro-icon/components' {
  interface IconProps {
    name: string
    class?: string
    [key: string]: unknown
  }

  const Icon: (props: IconProps) => unknown
  export { Icon }
}

declare module 'virtual:astro:assets/fonts/internal' {
  interface PreloadData {
    url: string
    type: string
  }

  interface FontData {
    preloadData: PreloadData[]
    css: string
  }

  interface FontsData {
    get(cssVariable: import('astro:assets').FontFamily): FontData | undefined
  }

  const fontsData: FontsData | undefined
  export { fontsData }
}

declare namespace astroHTML.JSX {
  interface HTMLAttributes {
    'class'?: string | null | undefined
    'id'?: string | null | undefined
    'style'?: string | null | undefined
    'slot'?: string | null | undefined
    'title'?: string | null | undefined
    'role'?: string | null | undefined
    'tabindex'?: string | number | null | undefined
    'aria-label'?: string | null | undefined
    'aria-labelledby'?: string | null | undefined
    'aria-describedby'?: string | null | undefined
    'aria-hidden'?: string | boolean | null | undefined
    'data-*'?: string | null | undefined
  }

  interface ButtonHTMLAttributes extends HTMLAttributes {
    type?: 'button' | 'submit' | 'reset' | null | undefined
    disabled?: string | boolean | null | undefined
    name?: string | null | undefined
    value?: string | number | string[] | null | undefined
    form?: string | null | undefined
  }

  interface InputHTMLAttributes extends HTMLAttributes {
    type?: string | null | undefined
    name?: string | null | undefined
    value?: string | number | string[] | null | undefined
    disabled?: string | boolean | null | undefined
    placeholder?: string | null | undefined
    required?: string | boolean | null | undefined
    checked?: string | boolean | null | undefined
  }
}

declare module '*.astro' {
  type AstroComponent = unknown
  const Component: AstroComponent
  export default Component
}
