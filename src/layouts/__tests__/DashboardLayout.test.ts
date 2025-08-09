// Vitest is imported via globals from tsconfig
// Use dynamic import to avoid TS resolution issues with .astro modules in some editors
// We'll import the component within each test
import { renderAstro } from '@/test/utils/astro'
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

vi.mock('@/components/layout/Footer.astro', () => ({
  default: () => '<mock-footer></mock-footer>',
}))

vi.mock('@/components/layout/Sidebar.astro', () => ({
  default: () => '<mock-sidebar></mock-sidebar>',
}))

vi.mock('@/components/base/Head.astro', () => ({
  default: (props: { title: string }) =>
    `<mock-head title="${props.title}"></mock-head>`,
}))

// The type definitions are now properly provided in the setup files
// and don't need to be redeclared here

describe('DashboardLayout', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders with default props', async () => {
    const compPath = ['..', 'DashboardLayout.astro'].join('/')
    // Use computed path to avoid TS attempting to statically resolve .astro module
    const { default: DashboardLayout } = (await import(compPath as any)) as any
    const { container } = await renderAstro(DashboardLayout as any)

    // Check basic structure
    expect(container.querySelector('html')).toBeInTheDocument()
    expect(container.querySelector('body')).toBeInTheDocument()
    expect(container.querySelector('main')).toBeInTheDocument()

    // Check default title and description
    expect(document.title).toBe('Pixelated Empathy | Dashboard')
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
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

    const compPath = ['..', 'DashboardLayout.astro'].join('/')
    const { default: DashboardLayout } = (await import(compPath as any)) as any
    const { container } = await renderAstro(DashboardLayout as any, customProps)

    // Check custom title and description
    expect(document.title).toBe('Custom Title')
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
      'Custom description',
    )

    // Check that optional components are not rendered
    expect(container.querySelector('header')).not.toBeInTheDocument()
    expect(container.querySelector('footer')).not.toBeInTheDocument()
    expect(container.querySelector('aside')).not.toBeInTheDocument()
  })

  it('applies custom className to content', async () => {
    const compPath = ['..', 'DashboardLayout.astro'].join('/')
    const { default: DashboardLayout } = (await import(compPath as any)) as any
    const { container } = await renderAstro(DashboardLayout as any, {
      contentClassName: 'custom-content-class',
    })

    const main = container.querySelector('main')
    expect(main).toHaveClass('custom-content-class')
  })

  it('renders with meta image and type', async () => {
    expect(document.querySelector('meta[property="og:image"]')).toHaveAttribute(
      'content',
      '/custom-image.png',
    )
    expect(document.querySelector('meta[property="og:type"]')).toHaveAttribute(
      'content',
      'article',
    )
  })

  it('renders error boundary', async () => {
    const compPath = ['..', 'DashboardLayout.astro'].join('/')
    const { default: DashboardLayout } = (await import(compPath as any)) as any
    const { container } = await renderAstro(DashboardLayout as any)

    expect(container.querySelector('error-boundary')).toBeInTheDocument()
  })
})
