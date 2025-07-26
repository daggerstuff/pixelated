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
    webkitSpeechRecognition: typeof SpeechRecognition
    SpeechRecognition: {
      new(): SpeechRecognition;
      prototype: SpeechRecognition;
    }
    SpeechGrammarList: {
      new(): SpeechGrammarList;
      prototype: SpeechGrammarList;
    }
  }
}

declare module 'astro' {
  interface AstroGlobal {
    locals: Locals
  }
  interface Locals {
    headers: Record<string, string>
    isPrerendered: boolean
    isSSR: boolean
    userPreferences: {
      language: string
      darkMode: boolean
      reducedMotion: boolean
      userAgent: string
      ip: string
      isIOS: boolean
      isAndroid: boolean
      isMobile: boolean
    }
    user?: {
      id: string
      name?: string
      email?: string
      role?: string
    }
  }
}

declare namespace App {
  interface Locals {
    isSSR?: boolean
    isPrerendered?: boolean
    userPreferences?: {
      darkMode?: boolean
      language?: string
      userAgent?: string
      isMobile?: boolean
    }
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
    frontmatter: Record<string, unknown>;
    file: string;
    rawContent: () => string;
    compiledContent: () => string;
    getHeadings: () => Array<{ depth: number; slug: string; text: string }>;
    default: unknown;
  }

  const Content: MarkdownContent
  export { Content }
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
