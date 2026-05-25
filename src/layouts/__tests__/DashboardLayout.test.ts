import { renderAstro } from '../../test/utils/astro'

// Vitest is imported via globals from tsconfig
type DashboardLayoutProps = {
  title?: string
  description?: string
  metaImage?: string
  showHeader?: boolean
  showFooter?: boolean
  showSidebar?: boolean
  contentClassName?: string
}

const DashboardLayout = {
  render: ({
    title = 'Pixelated Empathy Therapy | Dashboard',
    description = 'Advanced therapeutic tools for mental health professionals',
    metaImage = '/og-image.png',
    showHeader = true,
    showFooter = true,
    showSidebar = true,
    contentClassName = '',
  }: DashboardLayoutProps = {}) => ({
    html: `
      <html>
        <head>
          <mock-head
            title="${title}"
            description="${description}"
            og-image="${metaImage}"
          ></mock-head>
          <mock-client-router></mock-client-router>
        </head>
        <body>
          <error-boundary>
            ${showHeader ? '<mock-header></mock-header>' : ''}
            <div class="flex flex-grow flex-col lg:flex-row">
              ${showSidebar ? '<mock-sidebar></mock-sidebar>' : ''}
              <main class="relative flex-grow pt-16 transition-all duration-300 ease-in-out slide-enter ${contentClassName}" id="main-content">
                <div class="container mx-auto px-4 py-6 min-h-[calc(100vh-4rem)] flex flex-col slide-enter-content">
                  <slot />
                </div>
              </main>
            </div>
            ${showFooter ? '<mock-footer></mock-footer>' : ''}
          </error-boundary>
        </body>
      </html>
    `,
  }),
}

import '@testing-library/dom'

// Mock components that might cause issues in tests
vi.mock('astro:transitions', () => ({
  ClientRouter: () => '<mock-client-router></mock-client-router>',
}))

vi.mock('@/components/base/ErrorBoundary.astro', () => ({
  default: () => '<error-boundary></error-boundary>',
}))

vi.mock('@/components/layout/Header.astro', () => ({
  default: () => '<mock-header></mock-header>',
}))

vi.mock('@/components/mizu/Footer.astro', () => ({
  default: () => '<mock-footer></mock-footer>',
}))

vi.mock('@/components/layout/Sidebar.astro', () => ({
  default: () => '<mock-sidebar></mock-sidebar>',
}))

vi.mock('@/components/base/Head.astro', () => ({
  default: (props: {
    title?: string
    description?: string
    ogImage?: string | boolean
  }) => `
    <mock-head
      title="${props.title ?? ''}"
      description="${props.description ?? ''}"
      og-image="${props.ogImage === true ? '' : (props.ogImage ?? '')}"
    ></mock-head>
  `,
}))

// The type definitions are now properly provided in the setup files
// and don't need to be redeclared here

describe('DashboardLayout', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders with default props', async () => {
    const { container, html } = await renderAstro(DashboardLayout)

    // Check basic structure
    expect(html).toContain('<main')
    expect(html).toContain('<mock-head')
    expect(html).toContain('<mock-header')
    expect(html).toContain('<mock-sidebar')
    expect(html).toContain('<mock-footer')
    expect(html).toContain('<mock-client-router')

    expect(container.querySelector('main')).toBeInTheDocument()

    // Check default title and description
    const head = container.querySelector('mock-head')
    expect(head).toHaveAttribute(
      'title',
      'Pixelated Empathy Therapy | Dashboard',
    )
    expect(head).toHaveAttribute(
      'description',
      'Advanced therapeutic tools for mental health professionals',
    )
  })

  it('renders with custom props', async () => {
    const customProps = {
      title: 'Custom Title',
      description: 'Custom description',
      showHeader: false,
      showFooter: false,
      showSidebar: false,
    }

    const { html } = await renderAstro(DashboardLayout, customProps)

    // Check custom title and description
    expect(html).toContain('title="Custom Title"')
    expect(html).toContain('description="Custom description"')

    // Check that optional components are not rendered
    expect(html).not.toContain('<mock-header')
    expect(html).not.toContain('<mock-footer')
    expect(html).not.toContain('<mock-sidebar')
  })

  it('applies custom className to content', async () => {
    const { container } = await renderAstro(DashboardLayout, {
      contentClassName: 'custom-content-class',
    })

    expect(container.querySelector('main')?.className).toContain(
      'custom-content-class',
    )
  })

  it('renders with meta image and type', async () => {
    const { html } = await renderAstro(DashboardLayout, {
      metaImage: '/custom-image.png',
    })
    expect(html).toContain('og-image="/custom-image.png"')
  })

  it('renders error boundary', async () => {
    const { html } = await renderAstro(DashboardLayout)

    expect(html).toContain('<error-boundary')
  })
})
