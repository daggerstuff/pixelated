/**
 * Minimal Astro API types for local resolution
 * This file provides the APIRoute and APIContext types used across the codebase
 * to avoid module-resolution issues with some Astro versions.
 *
 * Based on: node_modules/astro/dist/types/public/common.d.ts
 * See: .notes/astro-apiroute-fix.md
 */

declare module 'astro' {
  /**
   * Minimal API context used by route handlers in this project.
   * Keep fields permissive to match the varied usages across the codebase.
   */
  export type APIContext = {
    request: Request
    /**
     * Cookies helper provided by Astro server runtime. Kept permissive.
     */
    cookies?: AstroCookies
    url?: URL
    params?: Record<string, string | undefined>
    site?: URL | string
    generator?: string
    /** commonly used by middleware and tests */
    locals?: Record<string, unknown>
    /** optional redirect helper used by some pages */
    redirect?: (path: string) => Response
    /** client IP or address when injected by middleware */
    clientAddress?: string
  }

  /**
   * APIRoute signature used throughout the repo.
   * Return value is a Response or Promise<Response> to match Fetch API.
   */
  export type APIRoute = (context: APIContext) => Response | Promise<Response>

  // Additional common exports (minimal and permissive)
  export type APIHandler = APIRoute
  export interface APIConfig {
    runtime?: string
    [key: string]: unknown
  }

  /**
   * Minimal representation of Astro's cookie helper. Only methods used in the
   * codebase are included here. Keep permissive to avoid tight coupling.
   */
  export type AstroCookiesGetResult = {
    name: string
    value?: string
    path?: string
    // other metadata possible but optional
  }

  export interface AstroCookies {
    get(name: string): AstroCookiesGetResult | undefined
    set(
      name: string,
      value: string,
      opts?: {
        path?: string
        maxAge?: number
        httpOnly?: boolean
        secure?: boolean
        sameSite?: 'Lax' | 'Strict' | 'None' | boolean
      },
    ): void
    delete(name: string, opts?: { path?: string }): void
  }

  /**
   * Global Astro runtime object available inside .astro pages. Adapted to be
   * permissive for the project's usage patterns.
   */
  export type AstroGlobal<Props = Record<string, any>> = {
    props?: Props
    params?: Record<string, string | undefined>
    request?: Request
    url?: URL
    site?: string | URL
    locals?: Record<string, unknown>
    redirect?: (path: string) => Response
  }
}
