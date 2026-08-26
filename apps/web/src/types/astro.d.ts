/// <reference types="astro/client" />

import 'astro'

declare global {
  interface Window {
    browserInfo: {
      language: string
      languages: string[]
      prefersDarkMode: boolean
      prefersReducedMotion: boolean
      userAgent: string
      url: string
      pathname: string
      host: string
    }
    pageData: {
      isSSR: boolean
      isPrerendered: boolean
      darkMode: boolean
      language: string
      userAgent: string
      path: string
      isMobile: boolean
    }
    // Define proper interfaces for speech recognition APIs
    // (Removed duplicate/conflicting SpeechRecognition and SpeechGrammarList declarations; see src/simulator/utils/speechRecognition.ts)
  }
}

declare module 'astro:content' {
  interface ContentCollectionMap {
    blog: Record<string, unknown>
    docs: Record<string, unknown>
    highlights: {
      projects: Record<
        string,
        {
          name: string
          link: string
          desc: string
          icon: string
        }[]
      >
    }
  }
}

// Additional module declarations for any custom types needed
declare module '*.md' {
  // Define a proper interface for markdown content
  interface MarkdownContent {
    frontmatter: Record<string, unknown>
    file: string
    rawContent: () => string
    compiledContent: () => string
    getHeadings: () => Array<{ depth: number; slug: string; text: string }>
    default: unknown
  }

  const MarkdownFile: MarkdownContent
}

// This is already defined in .astro-env.d.ts, so we don't need to redefine it here

// Therapeutic domain types
type TherapeuticDomain =
  | 'cognitive_behavioral'
  | 'psychodynamic'
  | 'existential'
  | 'humanistic'
  | 'interpersonal'
  | 'family_systems'
  | 'solution_focused'

// Feedback types
type FeedbackType =
  | 'empathetic_response'
  | 'active_listening'
  | 'technique_application'
  | 'therapeutic_alliance'
  | 'communication_style'
  | 'question_formulation'

// types module
