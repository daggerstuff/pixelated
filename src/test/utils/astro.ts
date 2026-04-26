type AstroSlotRenderer = { render: () => string }
type AstroRenderResult = string | { html: string }
type AstroRenderOptions = { default?: AstroSlotRenderer }
type AstroRenderFunction = (
  props: Record<string, unknown>,
  options?: AstroRenderOptions,
) => Promise<AstroRenderResult> | AstroRenderResult

export type AstroComponentFactory = Record<string, unknown> & {
  render?: (
    props: Record<string, unknown>,
    options?: AstroRenderOptions,
  ) => Promise<AstroRenderResult> | AstroRenderResult
}

function extractHtml(renderResult: unknown): string {
  if (typeof renderResult === 'string') {
    return renderResult
  }

  if (
    typeof renderResult === 'object' &&
    renderResult !== null &&
    'html' in renderResult
  ) {
    const html = (renderResult as Record<string, unknown>).html
    if (typeof html === 'string') {
      return html
    }
  }

  return String(renderResult)
}

/**
 * Renders an Astro component for testing
 * @param Component The Astro component to render
 * @param props Props to pass to the component
 * @param slotContent Optional content to pass to the default slot
 * @returns The rendered component
 */
export async function renderAstro<
  Props extends Record<string, unknown> = Record<string, unknown>,
>(
  Component: unknown,
  props?: Props,
  slotContent?: string,
): Promise<{
  astroContainer: HTMLDivElement
  container: HTMLDivElement
  html: string
  querySelector: (selector: string) => Element | null
  querySelectorAll: (selector: string) => NodeListOf<Element>
}> {
  const renderProps = props ?? {}
  const renderSlots = slotContent
    ? {
        default: {
          render: () => slotContent,
        },
      }
    : undefined
  const resolvedHtml = await (async () => {
    if (typeof Component === 'function') {
      return Promise.resolve(
        (Component as AstroRenderFunction)(renderProps, renderSlots),
      )
    }

    const factory = Component as AstroComponentFactory
    if (factory && typeof factory.render === 'function') {
      return Promise.resolve(factory.render(renderProps, renderSlots))
    }

    return Promise.resolve(
      '' as unknown as AstroRenderResult,
    )
  })()
  const html = extractHtml(resolvedHtml)
  const container = document.createElement('div')
  container.innerHTML = html

  // Return a testing-friendly interface
  return {
    astroContainer: container,
    container,
    html,
    querySelector: (selector: string) => container.querySelector(selector),
    querySelectorAll: (selector: string) =>
      container.querySelectorAll(selector),
  }
}

/**
 * Creates a mock Astro global object for testing
 * @param props Props to override in the mock
 * @returns A mock Astro global object
 */
export function createMockAstro(
  props: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    props,
    request: new Request('http://localhost:3000'),
    url: new URL('http://localhost:3000'),
    redirect: vi.fn(),
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
  class?: string
  className?: string
}
