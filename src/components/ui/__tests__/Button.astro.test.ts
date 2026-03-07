import { cleanup } from '@testing-library/react'

import Button from '../Button.astro'

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

describe('Button.astro', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    cleanup()
  })

  it('renders a button element by default', async () => {
    const { container } = await renderAstroComponent(Button, {}, 'Click me')

    const button = container.querySelector('button')
    expect(button).toBeTruthy()
    expect(button).toHaveTextContent('Click me')
    expect(button).toHaveAttribute('type', 'button')
    expect(button).not.toHaveAttribute('disabled')
  })

  it('renders an anchor element when href is provided', async () => {
    const { container } = await renderAstroComponent(
      Button,
      { href: '/dashboard' },
      'Go to Dashboard',
    )

    const anchor = container.querySelector('a')
    expect(anchor).toBeTruthy()
    expect(anchor).toHaveTextContent('Go to Dashboard')
    expect(anchor).toHaveAttribute('href', '/dashboard')
  })

  it('applies the correct variant classes', async () => {
    // Test default variant
    let { container } = await renderAstroComponent(
      Button,
      { variant: 'default' },
      'Default',
    )
    let button = container.querySelector('button')
    expect(button).toHaveClass('bg-primary')
    expect(button).toHaveClass('text-primary-foreground')

    // Test destructive variant
    document.body.innerHTML = ''
    const destructiveResult = await renderAstroComponent(
      Button,
      { variant: 'destructive' },
      'Destructive',
    )
    container = destructiveResult.container
    button = container.querySelector('button')
    expect(button).toHaveClass('bg-destructive')
    expect(button).toHaveClass('text-destructive-foreground')

    // Test outline variant
    document.body.innerHTML = ''
    const outlineResult = await renderAstroComponent(
      Button,
      { variant: 'outline' },
      'Outline',
    )
    container = outlineResult.container
    button = container.querySelector('button')
    expect(button).toHaveClass('border')
    expect(button).toHaveClass('border-input')
    expect(button).toHaveClass('bg-background')
  })

  it('applies the correct size classes', async () => {
    // Test default size
    let { container } = await renderAstroComponent(
      Button,
      { size: 'default' },
      'Default Size',
    )
    let button = container.querySelector('button')
    expect(button).toHaveClass('h-10')
    expect(button).toHaveClass('px-4')
    expect(button).toHaveClass('py-2')

    // Test small size
    document.body.innerHTML = ''
    const smallResult = await renderAstroComponent(
      Button,
      { size: 'sm' },
      'Small',
    )
    container = smallResult.container
    button = container.querySelector('button')
    expect(button).toHaveClass('h-9')
    expect(button).toHaveClass('px-3')

    // Test large size
    document.body.innerHTML = ''
    const largeResult = await renderAstroComponent(
      Button,
      { size: 'lg' },
      'Large',
    )
    container = largeResult.container
    button = container.querySelector('button')
    expect(button).toHaveClass('h-11')
    expect(button).toHaveClass('px-8')
  })

  it('handles loading state correctly', async () => {
    const { container } = await renderAstroComponent(
      Button,
      { loading: true, loadingText: 'Processing...' },
      'Submit',
    )

    const button = container.querySelector('button')
    expect(button).toHaveAttribute('disabled')
    expect(button).toHaveTextContent('Processing...')

    // Check for loading spinner
    const spinner = container.querySelector('svg.animate-spin')
    expect(spinner).toBeTruthy()
  })

  it('handles loading state without loading text', async () => {
    const { container } = await renderAstroComponent(
      Button,
      { loading: true },
      'Submit',
    )

    const button = container.querySelector('button')
    expect(button).toHaveAttribute('disabled')
    expect(button).toHaveTextContent('Submit')

    // Check for loading spinner
    const spinner = container.querySelector('svg.animate-spin')
    expect(spinner).toBeTruthy()
  })

  it('passes through custom attributes correctly', async () => {
    const { container } = await renderAstroComponent(
      Button,
      {
        'id': 'custom-button',
        'aria-label': 'Custom Action',
        'data-testid': 'action-button',
      },
      'Custom Button',
    )

    const button = container.querySelector('button')
    expect(button).toHaveAttribute('id', 'custom-button')
    expect(button).toHaveAttribute('aria-label', 'Custom Action')
    expect(button).toHaveAttribute('data-testid', 'action-button')
  })
})
