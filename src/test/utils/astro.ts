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
}> {
  const renderProps = slotContent ? { ...props, slot: slotContent } : props
  const html = await Component.render(renderProps)
  const container = document.createElement('div')
  container.innerHTML = html

  // Return a testing-friendly interface
  return {
    astroContainer: container,
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
export function createMockAstro(props: Record<string, unknown> = {}) {
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
  'class'?: string
  'className'?: string
}
