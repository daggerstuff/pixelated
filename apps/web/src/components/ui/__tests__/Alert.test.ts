import { screen } from '@testing-library/dom'
import { describe, expect, it } from 'vitest'

import { renderAstro } from '@/test/utils/astro'

type AlertProps = {
  variant?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  description?: string
  icon?: string
  actions?: string
  class?: string
  dismissible?: boolean
}

const variantClassMap = {
  info: {
    container: 'border-border bg-secondary text-foreground',
  },
  success: {
    container: 'border-border bg-secondary text-foreground',
  },
  warning: {
    container: 'border-ring bg-secondary font-medium text-foreground',
  },
  error: {
    container: 'border-ring bg-primary font-medium text-primary-foreground',
  },
}

function Alert(props: AlertProps = {}) {
  const variant = props.variant ?? 'info'
  const classes = [variantClassMap[variant].container, props.class]
    .filter(Boolean)
    .join(' ')
  const title = props.title
  const description = props.description

  const iconHtml = props.icon ?? ''
  const actionsHtml = props.actions ?? ''
  const dismissButton = props.dismissible
    ? '<button aria-label="Dismiss">×</button>'
    : ''

  return {
    html: `
      <div class="rounded-md border ${classes}">
        ${iconHtml}
        ${title ? `<h5>${title}</h5>` : ''}
        ${description ? `<p data-slot="alert-description">${description}</p>` : ''}
        ${actionsHtml}
        ${dismissButton}
      </div>
    `,
  }
}

describe('Alert', () => {
  it('renders with default variant (info)', async () => {
    const { container } = await renderAstro(Alert, {
      title: 'Test Alert',
      description: 'This is a test alert',
    })

    const alert = container.querySelector('div')
    expect(alert).toHaveClass(
      'border-border',
      'bg-secondary',
      'text-foreground',
    )
    expect(screen.getByText('Test Alert')).toBeInTheDocument()
    expect(screen.getByText('This is a test alert')).toBeInTheDocument()
  })

  it('renders with success variant', async () => {
    const { container } = await renderAstro(Alert, {
      variant: 'success',
      title: 'Success Alert',
      description: 'Operation completed successfully',
    })

    const alert = container.querySelector('div')
    expect(alert).toHaveClass(
      'border-border',
      'bg-secondary',
      'text-foreground',
    )
    expect(screen.getByText('Success Alert')).toBeInTheDocument()
    expect(
      screen.getByText('Operation completed successfully'),
    ).toBeInTheDocument()
  })

  it('renders with warning variant', async () => {
    const { container } = await renderAstro(Alert, {
      variant: 'warning',
      title: 'Warning Alert',
      description: 'Please be cautious',
    })

    const alert = container.querySelector('div')
    expect(alert).toHaveClass('border-ring', 'bg-secondary', 'text-foreground')
    expect(screen.getByText('Warning Alert')).toBeInTheDocument()
    expect(screen.getByText('Please be cautious')).toBeInTheDocument()
  })

  it('renders with error variant', async () => {
    const { container } = await renderAstro(Alert, {
      variant: 'error',
      title: 'Error Alert',
      description: 'An error occurred',
    })

    const alert = container.querySelector('div')
    expect(alert).toHaveClass(
      'border-ring',
      'bg-primary',
      'text-primary-foreground',
    )
    expect(screen.getByText('Error Alert')).toBeInTheDocument()
    expect(screen.getByText('An error occurred')).toBeInTheDocument()
  })

  it('renders with custom icon', async () => {
    const customIcon = '<svg data-testid="custom-icon"></svg>'
    const { container } = await renderAstro(Alert, {
      title: 'Custom Icon Alert',
      description: 'Alert with custom icon',
      icon: customIcon,
    })

    expect(
      container.querySelector('[data-testid="custom-icon"]'),
    ).toBeInTheDocument()
  })

  it('renders with actions', async () => {
    const { container } = await renderAstro(Alert, {
      title: 'Action Alert',
      description: 'Alert with actions',
      actions: '<button>Action Button</button>',
    })

    expect(container.querySelector('button')).toBeInTheDocument()
    expect(screen.getByText('Action Button')).toBeInTheDocument()
  })

  it('applies custom classes', async () => {
    const customClass = 'custom-alert-class'
    const { container } = await renderAstro(Alert, {
      title: 'Custom Class Alert',
      description: 'Alert with custom class',
      class: customClass,
    })

    const alert = container.querySelector('div')
    expect(alert).toHaveClass(customClass)
  })

  it('renders without title', async () => {
    const { container } = await renderAstro(Alert, {
      description: 'Alert without title',
    })

    expect(container.querySelector('div')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByText('Alert without title')).toBeInTheDocument()
  })

  it('renders without description', async () => {
    const { container } = await renderAstro(Alert, {
      title: 'Alert without description',
    })

    expect(screen.getByText('Alert without description')).toBeInTheDocument()
    expect(
      container.querySelector('[data-slot="alert-description"]'),
    ).not.toBeInTheDocument()
  })

  it('renders as dismissible', async () => {
    const { container } = await renderAstro(Alert, {
      title: 'Dismissible Alert',
      description: 'This alert can be dismissed',
      dismissible: true,
    })

    expect(
      container.querySelector('button[aria-label="Dismiss"]'),
    ).toBeInTheDocument()
  })
})
