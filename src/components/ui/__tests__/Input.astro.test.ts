import { cleanup } from '@testing-library/react'
import Input from '../Input.astro'

// Helper function to render Astro components in tests
async function renderAstroComponent(
  Component: any,
  props = {},
  slotContent: string | null = null,
) {
  // Add slot content if provided
  const renderOptions = slotContent
    ? { default: { render: () => slotContent, name: 'default' } }
    : {}
  const html = await Component.render(props, renderOptions)
  const container = document.createElement('div')
  container.innerHTML = html.html
  document.body.appendChild(container)
  return { container }
}

describe('Input.astro', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    cleanup()
  })

  it('renders an input element', async () => {
    const { container } = await renderAstroComponent(Input, { id: 'test-input' })
    const input = container.querySelector('input')
    expect(input).toBeTruthy()
    expect(input).toHaveAttribute('id', 'test-input')
  })

  it('sets aria-invalid="true" when error prop is true', async () => {
    const { container } = await renderAstroComponent(Input, { error: true })
    const input = container.querySelector('input')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('does not set aria-invalid when error prop is false or missing', async () => {
    const { container } = await renderAstroComponent(Input, { error: false })
    const input = container.querySelector('input')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('sets aria-describedby when provided', async () => {
    const { container } = await renderAstroComponent(Input, { 'aria-describedby': 'helper-text' })
    const input = container.querySelector('input')
    expect(input).toHaveAttribute('aria-describedby', 'helper-text')
  })

  it('applies error classes when error prop is true', async () => {
    const { container } = await renderAstroComponent(Input, { error: true })
    const input = container.querySelector('input')
    expect(input).toHaveClass('border-destructive')
    expect(input).toHaveClass('focus-visible:ring-destructive')
  })
})
