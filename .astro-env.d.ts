/// <reference types="astro/client" />

import './src/env.d.ts'

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
