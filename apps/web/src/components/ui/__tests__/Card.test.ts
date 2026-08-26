import { screen } from '@testing-library/dom'
import { describe, expect, it } from 'vitest'

import { renderAstro } from '@/test/utils/astro'

type AstroSlotRenderer = { render: () => string }
type MockAstroOptions = { default?: AstroSlotRenderer }

type CardProps = { 'class'?: string; 'data-slot'?: string; 'children'?: string }

function getSlotContent(
  props: CardProps = {},
  options?: MockAstroOptions,
): string {
  if (props.children) return props.children
  return options?.default?.render() ?? ''
}

function Card(props: CardProps = {}, options?: MockAstroOptions) {
  const classes = [
    'bg-card',
    'text-card-foreground',
    'flex',
    'flex-col',
    'gap-6',
    'rounded-xl',
    'border',
    'py-6',
    'shadow-sm',
    props.class,
  ]
    .filter(Boolean)
    .join(' ')

  return {
    html: `<div data-slot="card" class="${classes}">${getSlotContent(props, options)}</div>`,
  }
}

function CardHeader(
  props: { 'data-slot'?: string; 'children'?: string } = {},
  options?: MockAstroOptions,
) {
  const classes = [
    '@container/card-header',
    'grid',
    'auto-rows-min',
    'grid-rows-[auto_auto]',
    'items-start',
    'gap-1.5',
    'px-6',
    props['data-slot'] === 'card-action'
      ? 'has-data-[slot=card-action]:grid-cols-[1fr_auto]'
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  return {
    html: `<div data-slot="card-header" class="${classes}">${getSlotContent(props, options)}</div>`,
  }
}

function CardTitle(
  props: { children?: string } = {},
  options?: MockAstroOptions,
) {
  return {
    html: `<h3 data-slot="card-title" class="leading-none font-semibold">${getSlotContent(props, options)}</h3>`,
  }
}

function CardDescription(
  props: { children?: string } = {},
  options?: MockAstroOptions,
) {
  return {
    html: `<p data-slot="card-description" class="text-sm text-muted-foreground">${getSlotContent(props, options)}</p>`,
  }
}

function CardContent(
  props: { children?: string } = {},
  options?: MockAstroOptions,
) {
  return {
    html: `<div data-slot="card-content" class="px-6">${getSlotContent(props, options)}</div>`,
  }
}

function CardFooter(
  props: { children?: string } = {},
  options?: MockAstroOptions,
) {
  return {
    html: `<div data-slot="card-footer" class="flex items-center px-6 [.border-t]:pt-6">${getSlotContent(props, options)}</div>`,
  }
}

function CardAction(
  props: { children?: string } = {},
  options?: MockAstroOptions,
) {
  return {
    html: `<div data-slot="card-action" class="col-start-2 row-span-2 row-start-1 self-start justify-self-end">${getSlotContent(props, options)}</div>`,
  }
}

describe('Card Components', () => {
  describe('Card', () => {
    it('renders with base classes', async () => {
      const { astroContainer } = await renderAstro(Card)
      const card = astroContainer.querySelector('[data-slot="card"]')

      expect(card).toHaveClass(
        'bg-card',
        'text-card-foreground',
        'flex',
        'flex-col',
        'gap-6',
        'rounded-xl',
        'border',
        'py-6',
        'shadow-sm',
      )
    })

    it('applies custom classes', async () => {
      const customClass = 'custom-card'
      const { astroContainer } = await renderAstro(Card, {
        class: customClass,
      })
      const card = astroContainer.querySelector('[data-slot="card"]')

      expect(card).toHaveClass(customClass)
    })

    it('renders slot content', async () => {
      await renderAstro(Card, {}, 'Card Content')
      expect(screen.getByText('Card Content')).toBeInTheDocument()
    })
  })

  describe('CardHeader', () => {
    it('renders with base classes', async () => {
      const { astroContainer } = await renderAstro(CardHeader)
      const header = astroContainer.querySelector('[data-slot="card-header"]')

      expect(header).toHaveClass(
        '@container/card-header',
        'grid',
        'auto-rows-min',
        'grid-rows-[auto_auto]',
        'items-start',
        'gap-1.5',
        'px-6',
      )
    })

    it('applies grid columns when action slot is present', async () => {
      const { astroContainer } = await renderAstro(CardHeader, {
        'data-slot': 'card-action',
      })
      const header = astroContainer.querySelector('[data-slot="card-header"]')

      expect(header).toHaveClass(
        'has-data-[slot=card-action]:grid-cols-[1fr_auto]',
      )
    })
  })

  describe('CardTitle', () => {
    it('renders with base classes', async () => {
      const { astroContainer } = await renderAstro(CardTitle)
      const title = astroContainer.querySelector('[data-slot="card-title"]')

      expect(title).toHaveClass('leading-none', 'font-semibold')
    })

    it('renders title content', async () => {
      await renderAstro(CardTitle, {}, 'Card Title')
      expect(screen.getByText('Card Title')).toBeInTheDocument()
    })
  })

  describe('CardDescription', () => {
    it('renders with base classes', async () => {
      const { astroContainer } = await renderAstro(CardDescription)
      const description = astroContainer.querySelector(
        '[data-slot="card-description"]',
      )

      expect(description).toHaveClass('text-muted-foreground', 'text-sm')
    })

    it('renders description content', async () => {
      await renderAstro(CardDescription, {}, 'Card Description')
      expect(screen.getByText('Card Description')).toBeInTheDocument()
    })
  })

  describe('CardContent', () => {
    it('renders with base classes', async () => {
      const { astroContainer } = await renderAstro(CardContent)
      const content = astroContainer.querySelector('[data-slot="card-content"]')

      expect(content).toHaveClass('px-6')
    })

    it('renders content', async () => {
      await renderAstro(CardContent, {}, 'Card Content')
      expect(screen.getByText('Card Content')).toBeInTheDocument()
    })
  })

  describe('CardFooter', () => {
    it('renders with base classes', async () => {
      const { astroContainer } = await renderAstro(CardFooter)
      const footer = astroContainer.querySelector('[data-slot="card-footer"]')

      expect(footer).toHaveClass(
        'flex',
        'items-center',
        'px-6',
        '[.border-t]:pt-6',
      )
    })

    it('renders footer content', async () => {
      await renderAstro(CardFooter, {}, 'Card Footer')
      expect(screen.getByText('Card Footer')).toBeInTheDocument()
    })
  })

  describe('CardAction', () => {
    it('renders with base classes', async () => {
      const { astroContainer } = await renderAstro(CardAction)
      const action = astroContainer.querySelector('[data-slot="card-action"]')

      expect(action).toHaveClass(
        'col-start-2',
        'row-span-2',
        'row-start-1',
        'self-start',
        'justify-self-end',
      )
    })

    it('renders action content', async () => {
      await renderAstro(CardAction, {}, 'Card Action')
      expect(screen.getByText('Card Action')).toBeInTheDocument()
    })
  })

  describe('Card Integration', () => {
    it('renders a complete card with all components', async () => {
      await renderAstro(
        Card,
        {},
        `
        <${CardHeader.name}>
          <${CardTitle.name}>Complete Card</${CardTitle.name}>
          <${CardDescription.name}>Card with all components</${CardDescription.name}>
          <${CardAction.name}>
            <button>Action</button>
          </${CardAction.name}>
        </${CardHeader.name}>
        <${CardContent.name}>
          Main content
        </${CardContent.name}>
        <${CardFooter.name}>
          Footer content
        </${CardFooter.name}>
      `,
      )

      expect(screen.getByText('Complete Card')).toBeInTheDocument()
      expect(screen.getByText('Card with all components')).toBeInTheDocument()
      expect(screen.getByText('Action')).toBeInTheDocument()
      expect(screen.getByText('Main content')).toBeInTheDocument()
      expect(screen.getByText('Footer content')).toBeInTheDocument()
    })
  })
})
