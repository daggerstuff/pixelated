import { cleanup } from '@testing-library/react'

import SearchDemo from '../SearchDemo.astro'

// Mock the SearchDemoReact component
vi.mock('../SearchDemoReact', () => {
  const mockFn = vi.fn()
  mockFn.mockImplementation(() => {
    // Return a mock implementation description rather than JSX
    // This avoids TypeScript errors while still mocking the component
    return {
      type: 'div',
      props: {
        'data-testid': 'search-demo-react',
        'children': [
          {
            type: 'input',
            props: {
              'type': 'text',
              'placeholder': 'Search for anything...',
              'data-testid': 'search-input',
            },
          },
          {
            type: 'button',
            props: {
              children: 'Search',
            },
          },
          {
            type: 'div',
            props: {
              className: 'search-results',
              children: [
                {
                  type: 'div',
                  props: {
                    className: 'result-item',
                    children: 'Sample search result',
                  },
                },
              ],
            },
          },
        ],
      },
    }
  })
  return { default: mockFn }
})

// Helper function to render Astro components in tests
async function renderAstroComponent(Component: any, props = {}) {
  const { default: defaultExport } = Component
  const html = await defaultExport.render(props)
  const container = document.createElement('div')
  container.innerHTML = html.html
  document.body.appendChild(container)
  return { container }
}

describe('SearchDemo.astro', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders with default props', async () => {
    const { container } = await renderAstroComponent(SearchDemo)

    // Check if the title and description are rendered with default values
    expect(container.querySelector('h2')).toHaveTextContent('Search Demo')
    expect(container.querySelector('p')).toHaveTextContent(
      'Try our advanced search capabilities with this interactive demo',
    )

    // Check if client component placeholder exists
    expect(container.innerHTML).toContain('search-demo-react')
  })

  it('renders with custom props', async () => {
    const customProps = {
      title: 'Custom Search',
      description: 'Custom description for search',
      className: 'custom-class',
    }

    const { container } = await renderAstroComponent(SearchDemo, customProps)

    // Check if the custom title and description are rendered
    expect(container.querySelector('h2')).toHaveTextContent('Custom Search')
    expect(container.querySelector('p')).toHaveTextContent(
      'Custom description for search',
    )

    // Check if custom class is applied
    expect(container.querySelector('div')).toHaveClass('custom-class')
  })

  it('applies transition styles', async () => {
    const { container } = await renderAstroComponent(SearchDemo)

    // Check if transition styles are applied
    const mainDiv = container.querySelector('div')
    expect(mainDiv).toHaveClass('transition-colors')
    expect(mainDiv).toHaveClass('duration-300')

    // Check if style element is included
    const styleElement = container.querySelector('style')
    expect(styleElement).toBeTruthy()
    expect(styleElement?.textContent).toContain('--transition-duration: 300ms')
  })
})
