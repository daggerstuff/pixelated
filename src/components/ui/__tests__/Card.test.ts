import { screen } from '@testing-library/dom'
import { renderAstro } from '@/test/utils/astro'
import Card from '../Card.astro'
import CardHeader from '../CardHeader.astro'
import CardTitle from '../CardTitle.astro'
import CardDescription from '../CardDescription.astro'
import CardContent from '../CardContent.astro'
import CardFooter from '../CardFooter.astro'
import CardAction from '../CardAction.astro'

describe('Card Components', () => {
  describe('Card', () => {
    it('renders with base classes', async () => {
      const { astroContainer } = await renderAstro(Card as any)
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
      const { astroContainer } = await renderAstro(Card as any, { class: customClass })
      const card = astroContainer.querySelector('[data-slot="card"]')

      expect(card).toHaveClass(customClass)
    })

    it('renders slot content', async () => {
      await renderAstro(Card as any, {}, 'Card Content')
      expect(screen.getByText('Card Content')).toBeInTheDocument()
    })
  })

  describe('CardHeader', () => {
    it('renders with base classes', async () => {
      const { astroContainer } = await renderAstro(CardHeader as any)
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
      const { astroContainer } = await renderAstro(CardHeader as any, {
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
      const { astroContainer } = await renderAstro(CardTitle as any)
      const title = astroContainer.querySelector('[data-slot="card-title"]')

      expect(title).toHaveClass('leading-none', 'font-semibold')
    })

    it('renders title content', async () => {
      await renderAstro(CardTitle as any, {}, 'Card Title')
      expect(screen.getByText('Card Title')).toBeInTheDocument()
    })
  })

  describe('CardDescription', () => {
    it('renders with base classes', async () => {
      const { astroContainer } = await renderAstro(CardDescription as any)
      const description = astroContainer.querySelector(
        '[data-slot="card-description"]',
      )

      expect(description).toHaveClass('text-muted-foreground', 'text-sm')
    })

    it('renders description content', async () => {
      await renderAstro(CardDescription as any, {}, 'Card Description')
      expect(screen.getByText('Card Description')).toBeInTheDocument()
    })
  })

  describe('CardContent', () => {
    it('renders with base classes', async () => {
      const { astroContainer } = await renderAstro(CardContent as any)
      const content = astroContainer.querySelector('[data-slot="card-content"]')

      expect(content).toHaveClass('px-6')
    })

    it('renders content', async () => {
      await renderAstro(CardContent as any, {}, 'Card Content')
      expect(screen.getByText('Card Content')).toBeInTheDocument()
    })
  })

  describe('CardFooter', () => {
    it('renders with base classes', async () => {
      const { astroContainer } = await renderAstro(CardFooter as any)
      const footer = astroContainer.querySelector('[data-slot="card-footer"]')

      expect(footer).toHaveClass(
        'flex',
        'items-center',
        'px-6',
        '[.border-t]:pt-6',
      )
    })

    it('renders footer content', async () => {
      await renderAstro(CardFooter as any, {}, 'Card Footer')
      expect(screen.getByText('Card Footer')).toBeInTheDocument()
    })
  })

  describe('CardAction', () => {
    it('renders with base classes', async () => {
      const { astroContainer } = await renderAstro(CardAction as any)
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
      await renderAstro(CardAction as any, {}, 'Card Action')
      expect(screen.getByText('Card Action')).toBeInTheDocument()
    })
  })

  describe('Card Integration', () => {
    it('renders a complete card with all components', async () => {
      await renderAstro(
        Card as any,
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
