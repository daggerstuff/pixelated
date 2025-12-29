declare module 'gray-matter' {
  export interface GrayMatterFile<T = unknown> {
    data: Record<string, unknown>
    content: T
    excerpt?: T
    orig: T
    language: string
    matter: string
    stringify: (lang: string) => T
  }

  function matter<T = string>(
    content: T,
    options?: {
      excerpt?: boolean | ((instance: GrayMatterFile<T>) => void)
      excerpt_separator?: string
      engines?: Record<string, unknown>
      language?: string
      delimiters?: string | [string, string]
    },
  ): GrayMatterFile<T>

  namespace matter {
    export function stringify<T = string>(
      content: T,
      data: Record<string, unknown>,
      options?: { language?: string; delimiters?: [string, string] },
    ): string

    export function read(
      filepath: string,
      options?: {
        excerpt?: boolean | ((instance: GrayMatterFile<string>) => void)
        excerpt_separator?: string
        engines?: Record<string, unknown>
        language?: string
        delimiters?: string | [string, string]
      },
    ): GrayMatterFile<string>
  }

  export default matter
}
