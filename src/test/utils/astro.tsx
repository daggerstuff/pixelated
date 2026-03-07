import { render } from '@testing-library/react'
import React from 'react'

/**
 * Flexible type for Astro component render results
 */
type AstroRenderResult = string | { html: string } | Promise<string> | Promise<{ html: string }>

/**
 * Base interface for Astro components with a render method
 */
export interface AstroComponentWithRender {
  render: (
    props?: Record<string, unknown>,
    slots?: Record<string, { render: () => string; name: string }>,
  ) => Promise<AstroRenderResult>
}

/**
 * Function-based Astro component (rare but possible)
 */
export type AstroFunctionComponent = (
  props: Record<string, unknown>,
) => Promise<AstroRenderResult> | AstroRenderResult

/**
 * Union type for all possible Astro component structures
 * This allows accepting components in various formats
 */
export type AstroComponent =
  | AstroComponentWithRender
  | AstroFunctionComponent
  | {
    default: AstroComponentWithRender | AstroFunctionComponent
  }
  | {
    render: (
      props?: Record<string, unknown>,
      slots?: Record<string, { render: () => string; name: string }>,
    ) => Promise<AstroRenderResult>
  }
  | ((
    props: Record<string, unknown>,
  ) => Promise<AstroRenderResult> | AstroRenderResult)

/**
 * Extract HTML string from render result
 */
async function extractHtml(result: AstroRenderResult): Promise<string> {
  const resolved = await Promise.resolve(result)

  if (typeof resolved === 'string') {
    return resolved
  }

  if (typeof resolved === 'object' && resolved !== null && 'html' in resolved) {
    return (resolved as { html: string }).html
  }

  throw new Error('Invalid render result format')
}

/**
 * Normalize component to have a render method
 */
function normalizeComponent(
  component: unknown,
): AstroComponentWithRender {
  // Handle default export
  if (
    typeof component === 'object' &&
    component !== null &&
    'default' in component
  ) {
    return normalizeComponent((component as { default: unknown }).default)
  }

  // Handle function component by wrapping it
  if (typeof component === 'function' && !('render' in component)) {
    return {
      render: async (props = {}) => {
        return await (component as AstroFunctionComponent)(props);
      },
    }
  }

  // Handle component with render method
  if (
    typeof component === 'object' &&
    component !== null &&
    'render' in component &&
    typeof (component as { render: unknown }).render === 'function'
  ) {
    return component as AstroComponentWithRender
  }

  // Fallback: try to use as-is (for backward compatibility)
  return component as AstroComponentWithRender
}

/**
 * Renders an Astro component for testing
 * @param Component The Astro component to render (supports various formats)
 * @param props Props to pass to the component
 * @param slotContent Optional content to pass to the default slot
 * @returns The rendered component
 */
export async function renderAstro<Props extends Record<string, unknown>>(
  Component: AstroComponent | unknown,
  props: Props = {} as Props,
  slotContent?: string,
): Promise<{
  astroContainer: HTMLDivElement
  html: string
  querySelector: (selector: string) => Element | null
  querySelectorAll: (selector: string) => NodeListOf<Element>
  getByText: (text: string) => HTMLElement
  queryByText: (text: string) => HTMLElement | null
  getByRole: (role: string, options?: { name?: string }) => HTMLElement
  queryByRole: (role: string, options?: { name?: string }) => HTMLElement | null
  container: HTMLElement
  baseElement: HTMLElement
  debug: (baseElement?: HTMLElement) => void
  unmount: () => void
  rerender: (ui: React.ReactElement) => void
  asFragment: () => DocumentFragment
}> {
  // Normalize component to ensure it has a render method
  const normalizedComponent = normalizeComponent(Component)

  // Prepare render options with slot content if provided
  const renderOptions = slotContent
    ? {
      default: { render: () => slotContent, name: 'default' },
    }
    : undefined

  // Render the component
  const astroRenderResult = await normalizedComponent.render(props, renderOptions)
  const html = await extractHtml(astroRenderResult)

  const container = document.createElement('div')
  container.innerHTML = html

  // Using React render from testing library to handle the HTML content
  const renderResult = render(
    <div dangerouslySetInnerHTML={{ __html: html }} />,
  )

  return {
    astroContainer: container,
    html,
    querySelector: (selector: string) => container.querySelector(selector),
    querySelectorAll: (selector: string) =>
      container.querySelectorAll(selector),
    getByText: renderResult.getByText,
    queryByText: renderResult.queryByText,
    getByRole: renderResult.getByRole,
    queryByRole: renderResult.queryByRole,
    container: renderResult.container,
    baseElement: renderResult.baseElement,
    debug: renderResult.debug,
    unmount: renderResult.unmount,
    rerender: renderResult.rerender,
    asFragment: renderResult.asFragment,
  }
}

/**
 * Creates a mock Astro global object for testing
 * @param props Props to override in the mock
 * @returns A mock Astro global object
 */
export function createMockAstro(props: Record<string, unknown> = {}) {
  return {
    props,
    request: new Request('http://localhost:3000'),
    url: new URL('http://localhost:3000'),
    response: new Response(),
    slots: {},
    site: new URL('http://localhost:3000'),
    generator: 'Astro v4.0',
    ...props,
  }
}

/**
 * Type helper for mocking Astro props
 */
export type AstroMockProps<T> = T & {
  'client:load'?: boolean
  'client:visible'?: boolean
  'client:media'?: string
  'client:only'?: boolean
  'class'?: string
  'className'?: string
}

/**
 * Type helper to assert a component is compatible with renderAstro
 * Use this when TypeScript can't infer the type correctly
 */
export function asAstroComponent<T = unknown>(component: unknown): T {
  return component as T
}
