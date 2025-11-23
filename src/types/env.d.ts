/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly GRAFANA_URL: string
  readonly GRAFANA_API_KEY: string
  readonly GRAFANA_ORG_ID: string
  readonly SLACK_WEBHOOK: string
  readonly MONITORING_EMAIL_RECIPIENTS: string
  readonly APP_VERSION: string
  readonly VITE_TRAINING_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// types module (ambient ImportMeta preserved)
