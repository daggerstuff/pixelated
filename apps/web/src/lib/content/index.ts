import { ctaContent } from '@/lib/content/cta'
import { featuresContent } from '@/lib/content/features'
import { footerContent } from '@/lib/content/footer'
import { heroContent } from '@/lib/content/hero'
import { introContent } from '@/lib/content/intro'
import { scenariosContent } from '@/lib/content/scenarios'
import { workflowContent } from '@/lib/content/workflow'

export {
  ctaContent,
  featuresContent,
  footerContent,
  heroContent,
  introContent,
  scenariosContent,
  workflowContent,
}

export const homepageContent = {
  hero: heroContent,
  intro: introContent,
  scenarios: scenariosContent,
  how: workflowContent,
  features: featuresContent,
  cta: ctaContent,
  footer: footerContent,
} as const

export type HomepageContent = typeof homepageContent
