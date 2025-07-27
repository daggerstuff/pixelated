/// <reference types="astro/client" />

// Import types from React for HTML attributes (if needed in the future)
import "./src/env.d.ts"

// Ensure Astro recognizes HTML attributes
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

  // Button element interface
  interface ButtonHTMLAttributes extends HTMLAttributes {
    type?: 'button' | 'submit' | 'reset' | null | undefined
    disabled?: string | boolean | null | undefined
    name?: string | null | undefined
    value?: string | number | string[] | null | undefined
    form?: string | null | undefined
  }

  // Input element interface
  interface InputHTMLAttributes extends HTMLAttributes {
    type?: string | null | undefined
    name?: string | null | undefined
    value?: string | number | string[] | null | undefined
    disabled?: string | boolean | null | undefined
    placeholder?: string | null | undefined
    required?: string | boolean | null | undefined
    checked?: string | boolean | null | undefined
    // Add other input attributes as needed
  }

  // Add more element interfaces as needed
}

// Declare module for .astro files
declare module '*.astro' {
  type AstroComponent = unknown
  const Component: AstroComponent
  export default Component
}
