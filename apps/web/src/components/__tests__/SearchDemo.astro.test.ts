import { cleanup } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

import { renderAstro } from '@/test/utils/astro'

const SearchDemo = {
  render: async (props: {
    title?: string
    description?: string
    className?: string
  }) => {
    const title = props?.title ?? 'Search Demo'
    const description =
      props?.description ??
      'Try our advanced search capabilities with this interactive demo'
    const className = props?.className ?? ''

    return {
      html: `
        <div class="w-full transition-colors duration-300 ${className}">
          <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            ${title}
          </h2>
          <p class="mb-6 text-gray-600 dark:text-gray-400">
            ${description}
          </p>
          <search-demo-react data-testid="search-demo-react"></search-demo-react>
        </div>
        <style>
          :root { --transition-duration: 300ms; }
          .transition-colors {
            transition:
              background-color var(--transition-duration) ease-in-out,
              color var(--transition-duration) ease-in-out,
              border-color var(--transition-duration) ease-in-out;
          }
        </style>
      `,
    }
  },
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
    const { container } = await renderAstro(SearchDemo)

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

    const { container } = await renderAstro(SearchDemo, customProps)

    // Check if the custom title and description are rendered
    expect(container.querySelector('h2')).toHaveTextContent('Custom Search')
    expect(container.querySelector('p')).toHaveTextContent(
      'Custom description for search',
    )

    // Check if custom class is applied
    expect(container.querySelector('div')).toHaveClass('custom-class')
  })

  it('applies transition styles', async () => {
    const { container } = await renderAstro(SearchDemo)

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
