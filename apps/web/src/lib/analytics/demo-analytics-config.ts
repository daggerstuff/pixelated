// Unified Analytics Configuration for All Demo Pages
export interface DemoPageConfig {
  pageName: string
  pageTitle: string
  primaryColor: string
  abTestVariants: {
    headline: Record<string, string>
    cta: Record<string, string>
    urgency: Record<string, string>
  }
  conversionGoals: string[]
  keyMetrics: string[]
}

export const DEMO_PAGES_CONFIG: Record<string, DemoPageConfig> = {
  'clinical-vault-trainer': {
    pageName: 'clinical-vault-trainer',
    pageTitle: 'ClinicalVault Trainer',
    primaryColor: 'red',
    abTestVariants: {
      headline: {
        A: 'The Therapy Training That HIPAA Made Impossible',
        B: 'Train Therapists Without Risking Real Patients',
        C: 'Practice Crisis Interventions Safely',
      },
      cta: {
        A: 'Experience the Impossible →',
        B: 'Start Safe Training Now →',
        C: 'See Live Demo →',
      },
      urgency: {
        A: 'Previously Impossible Training Method',
        B: 'Zero-Risk Training Available Now',
        C: 'Revolutionary Training System',
      },
    },
    conversionGoals: ['demo_interaction', 'cta_click', 'contact_form'],
    keyMetrics: [
      'crisis_detection_demo',
      'persistent_patient_demo',
      'encrypted_analysis_demo',
    ],
  },

  'synthetic-training-generator': {
    pageName: 'synthetic-training-generator',
    pageTitle: 'Synthetic Training Generator',
    primaryColor: 'cyan',
    abTestVariants: {
      headline: {
        A: 'Generate 1,000 AI Patients In 12 Seconds',
        B: 'Create Unlimited Perfect Patients Instantly',
        C: 'Build Your AI Patient Library Now',
      },
      cta: {
        A: 'Generate AI Patients Now →',
        B: 'Start Creating Patients →',
        C: 'Build Patient Library →',
      },
      urgency: {
        A: 'AI Patient Generation Active',
        B: 'Unlimited Patient Creation Available',
        C: 'Advanced Generation System Ready',
      },
    },
    conversionGoals: [
      'patient_generation_demo',
      'cta_click',
      'technical_demo_request',
    ],
    keyMetrics: [
      'generation_speed_demo',
      'symptom_encoding_demo',
      'cultural_variation_demo',
    ],
  },

  'psychology-pipeline-processor': {
    pageName: 'psychology-pipeline-processor',
    pageTitle: 'Psychology Pipeline Processor',
    primaryColor: 'orange',
    abTestVariants: {
      headline: {
        A: 'Turn 50,000 Psychology Papers Into 1 Million Training Scenarios',
        B: 'Process Your Entire Curriculum In 6 Hours',
        C: 'Automate Psychology Training Development',
      },
      cta: {
        A: 'Start Pipeline Processing →',
        B: 'Process Curriculum Now →',
        C: 'Automate Development →',
      },
      urgency: {
        A: 'Industrial Pipeline Active',
        B: 'Curriculum Processing Available',
        C: 'Automation System Ready',
      },
    },
    conversionGoals: ['pipeline_demo', 'cta_click', 'curriculum_consultation'],
    keyMetrics: [
      'processing_speed_demo',
      'category_balancing_demo',
      'quality_assurance_demo',
    ],
  },

  'security-bias-detection-engine': {
    pageName: 'security-bias-detection-engine',
    pageTitle: 'Security & Bias Detection Engine',
    primaryColor: 'red',
    abTestVariants: {
      headline: {
        A: 'Catch Bias in Real-Time Before It Hurts Anyone',
        B: 'Protect Students and Patients From Unconscious Bias',
        C: 'Real-Time Bias Detection and Prevention',
      },
      cta: {
        A: 'Activate Bias Protection →',
        B: 'Start Protection Now →',
        C: 'Enable Detection →',
      },
      urgency: {
        A: 'Security Shield Active',
        B: 'Real-Time Protection Available',
        C: 'Advanced Detection System Ready',
      },
    },
    conversionGoals: [
      'bias_detection_demo',
      'cta_click',
      'security_consultation',
    ],
    keyMetrics: [
      'real_time_detection_demo',
      'encrypted_analysis_demo',
      'intervention_trigger_demo',
    ],
  },
}

export const ANALYTICS_EVENTS = {
  // Page Events
  PAGE_VIEW: 'demo_page_view',
  PAGE_EXIT: 'demo_page_exit',

  // Engagement Events
  SECTION_VIEW: 'demo_section_view',
  SCROLL_DEPTH: 'demo_scroll_depth',
  TIME_ON_PAGE: 'demo_time_on_page',

  // Interaction Events
  DEMO_INTERACTION: 'demo_interaction',
  CTA_CLICK: 'demo_cta_click',
  BUTTON_CLICK: 'demo_button_click',

  // A/B Testing Events
  AB_TEST_VARIANT: 'ab_test_variant',
  AB_TEST_CONVERSION: 'ab_test_conversion',

  // Conversion Events
  CONTACT_FORM_START: 'contact_form_start',
  CONTACT_FORM_COMPLETE: 'contact_form_complete',
  DEMO_REQUEST: 'demo_request',

  // Technical Events
  ERROR_OCCURRED: 'demo_error',
  PERFORMANCE_METRIC: 'demo_performance',
} as const

export const SCROLL_DEPTH_THRESHOLDS = [25, 50, 75, 90, 100]
export const TIME_THRESHOLDS = [30, 60, 120, 300, 600] // seconds

export const ANALYTICS_CONFIG = {
  // Minimum sample size for statistical significance
  MIN_CONVERSIONS_FOR_SIGNIFICANCE: 100,

  // Confidence level required for recommendations
  REQUIRED_CONFIDENCE_LEVEL: 95,

  // Session timeout (minutes)
  SESSION_TIMEOUT: 30,

  // Batch size for sending analytics events
  BATCH_SIZE: 10,

  // Retry attempts for failed requests
  MAX_RETRY_ATTEMPTS: 3,

  // Local storage keys
  STORAGE_KEYS: {
    SESSION_ID: 'demo_session_id',
    AB_VARIANT: 'ab_test_variant',
    USER_PROPERTIES: 'demo_user_properties',
    EVENT_QUEUE: 'demo_event_queue',
  },
}

// Statistical significance calculation helpers
export function calculateStatisticalSignificance(
  controlConversions: number,
  controlSessions: number,
  testConversions: number,
  testSessions: number,
): {
  pValue: number
  confidenceLevel: number
  isSignificant: boolean
  recommendation: string
} {
  // Simplified z-test for proportions
  const p1 = controlConversions / controlSessions
  const p2 = testConversions / testSessions
  const pooledP =
    (controlConversions + testConversions) / (controlSessions + testSessions)

  const se = Math.sqrt(
    pooledP * (1 - pooledP) * (1 / controlSessions + 1 / testSessions),
  )
  const zScore = Math.abs(p2 - p1) / se

  // Convert z-score to p-value (two-tailed test)
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)))
  const confidenceLevel = (1 - pValue) * 100
  const isSignificant =
    confidenceLevel >= ANALYTICS_CONFIG.REQUIRED_CONFIDENCE_LEVEL

  let recommendation = 'Continue testing'
  if (isSignificant) {
    if (p2 > p1) {
      recommendation = 'Test variant is significantly better'
    } else {
      recommendation = 'Control variant is significantly better'
    }
  } else if (
    controlSessions + testSessions <
    ANALYTICS_CONFIG.MIN_CONVERSIONS_FOR_SIGNIFICANCE
  ) {
    recommendation = 'Need more data for significance'
  }

  return {
    pValue,
    confidenceLevel,
    isSignificant,
    recommendation,
  }
}

// Normal cumulative distribution function approximation
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  const prob =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))

  return x > 0 ? 1 - prob : prob
}

export type AnalyticsEvent = keyof typeof ANALYTICS_EVENTS
export type DemoPageName = keyof typeof DEMO_PAGES_CONFIG
