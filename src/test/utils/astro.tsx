import { render } from '@testing-library/react'
import React from 'react'

/**
 * Renders an Astro component for testing
 * @param Component The Astro component to render
 * @param props Props to pass to the component
 * @param slotContent Optional content to pass to the default slot
 * @returns The rendered component
 */
interface AstroComponent {
  render: (
    props: Record<string, unknown> & { slot?: string | undefined },
  ) => Promise<string>
}

export async function renderAstro<Props extends Record<string, unknown>>(
  Component: AstroComponent,
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
  const renderProps = slotContent ? { ...props, slot: slotContent } : props
  const html = await Component.render(renderProps)
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
