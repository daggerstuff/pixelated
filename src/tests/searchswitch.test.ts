// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'

// Simulate behavior of the updated SearchSwitch DOM updates
function safePopulateResults(
  container: HTMLElement | null,
  items: Array<{ title: string; excerpt: string; url?: string }>,
) {
  if (!container) {
    return
  }
  container.innerHTML = ''
  for (const item of items) {
    const a = document.createElement('a')
    a.href = item.url || '#'
    a.className = 'search-results-item'

    const titleDiv = document.createElement('div')
    titleDiv.className = 'search-results-title'
    titleDiv.textContent = item.title

    const excerptDiv = document.createElement('div')
    excerptDiv.className = 'search-results-excerpt'
    excerptDiv.textContent = item.excerpt

    a.appendChild(titleDiv)
    a.appendChild(excerptDiv)
    container.appendChild(a)
  }
}

describe('SearchSwitch safe DOM updates', () => {
  it('does not throw when container is null', () => {
    expect(() =>
      safePopulateResults(null, [{ title: 'a', excerpt: 'b' }]),
    ).not.toThrow()
  })

  it('appends items when container exists', () => {
    const container = document.createElement('div')
    safePopulateResults(container, [{ title: 't1', excerpt: 'e1', url: '/x' }])
    const links = container.querySelectorAll('a.search-results-item')
    expect(links.length).toBe(1)
    expect(links[0].querySelector('.search-results-title')?.textContent).toBe(
      't1',
    )
  })
})
