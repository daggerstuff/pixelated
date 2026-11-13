/** @vitest-environment node */

/**
 * The trainee aside is a keyboard-reachable scroll container (VAL-UX-003).
 *
 * The send-control hit-target fix (VAL-UX-002) made the session row
 * `.session-panes { overflow: clip }` so a programmatic scroll could not move
 * the composer under the footer. `clip` is deliberately not a scroll container,
 * which is what makes it safe for the row — and also what makes it wrong for
 * the trainee aside, which is a *sibling* of the transcript column and cannot
 * move the composer.
 *
 * At 1440x900 the left (client-state) aside measured ~660px of client height
 * against ~1205px of scroll height, and VitalsMonitor's Retry button sat 293px
 * below the clip line with the aside's scrollTop stuck at 0. A keyboard user
 * could tab to it and type into a control that was never painted: WCAG 2.2 AA
 * 2.4.11 (Focus Not Obscured). `overflow: hidden` would have let the browser
 * scroll it into view; `clip` removes that path. `#session-notes` lives in the
 * right aside and fits at both viewports, so it is not the control this rule
 * exists for.
 *
 * The repair gives the aside its own vertical scroll (`overflow-y: auto`) and
 * leaves the row clipped, so both properties hold at once: the aside reveals
 * whatever it holds on focus, and the composer still cannot be scrolled.
 *
 * Astro pages have no component test runner in this repository, so this is a
 * structural guard over the page source and its stylesheet. The rendered proof
 * is the recorded focus probe (rect + container visible box for every focusable
 * aside control at 1440x900 and 1024x900) in
 * `results/hardening-regression-and-residual-fixes/`.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const sessionPage = readFileSync(
  fileURLToPath(new URL('../session/[sessionId].astro', import.meta.url)),
  'utf8',
)

/** The page's single stylesheet, without the surrounding tags. */
const styleBlock = (() => {
  const start = sessionPage.indexOf('<style>')
  const end = sessionPage.indexOf('</style>', start)
  return start === -1 || end === -1 ? '' : sessionPage.slice(start + 7, end)
})()

/** One `@media` block from the stylesheet, by its query. */
const mediaBlock = (query: string): string => {
  const start = styleBlock.indexOf(`@media (${query})`)
  if (start === -1) return ''
  const open = styleBlock.indexOf('{', start)
  let depth = 0
  for (let index = open; index < styleBlock.length; index += 1) {
    const char = styleBlock[index]
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return styleBlock.slice(open, index + 1)
    }
  }
  return ''
}

/**
 * Whether `block` declares `declaration` for `selector` — matching a selector
 * inside a comma-separated list.
 */
const declares = (
  block: string,
  selector: string,
  declaration: RegExp,
): boolean => {
  const rule = /([^{}]+)\{([^{}]*)\}/g
  const source = block.replace(/\/\*[\s\S]*?\*\//g, '')
  let match = rule.exec(source)
  while (match !== null) {
    const selectors = match[1].split(',').map((part) => part.trim())
    if (selectors.includes(selector) && declaration.test(match[2])) return true
    match = rule.exec(source)
  }
  return false
}

const desktopBlock = mediaBlock('min-width: 769px')
const mobileBlock = mediaBlock('max-width: 768px')

/** Every `<aside …>` opening tag on the page. */
const asideTags = [...sessionPage.matchAll(/<aside\b[^>]*>/g)].map(
  (match) => match[0],
)

/** Every aside element, from its opening tag to its closing tag. */
const asides = asideTags.map((tag) => {
  const start = sessionPage.indexOf(tag)
  const end = sessionPage.indexOf('</aside>', start)
  return start === -1 || end === -1
    ? ''
    : sessionPage.slice(start, end + '</aside>'.length)
})

/**
 * The `class` attribute of the first element that carries `className`.
 *
 * Utilities are read as a token set rather than a literal string: the formatter
 * sorts class attributes, so their order is not part of what these guards pin.
 */
const classAttributeOf = (source: string, className: string): string =>
  source.match(new RegExp(`class="([^"]*\\b${className}\\b[^"]*)"`))?.[1] ?? ''

describe('trainee aside: the focus target is a scroll container', () => {
  it('marks every trainee aside as a scroll container', () => {
    // The session page draws two trainee asides, both siblings of the
    // transcript column: the left client-state column (which holds the vitals
    // monitor's reconnect control and is the column that overflows at
    // 1440x900) and the right guidance column (which holds `#session-notes`
    // and fits at both viewports).
    expect(asideTags).toHaveLength(2)
    for (const tag of asideTags) {
      expect(tag).toMatch(/session-aside/)
    }
  })

  it('gives each aside its own vertical scroll on desktop', () => {
    expect(
      declares(desktopBlock, '.session-aside', /overflow-y:\s*auto/),
      'the aside must scroll itself so a focused field can be revealed',
    ).toBe(true)
  })

  it('leaves the row clipped so the composer cannot be scrolled', () => {
    // The VAL-UX-002 property must survive this repair: `clip` is what makes
    // the row unscrollable, and the aside is a sibling of the transcript, so
    // its scroll cannot move the composer.
    //
    // Asserted as a token set: the formatter sorts class attributes, so the
    // order of these utilities is not part of the contract.
    expect(classAttributeOf(sessionPage, 'session-panes').split(/\s+/)).toEqual(
      expect.arrayContaining(['flex-1', 'flex', 'session-panes']),
    )
    expect(declares(desktopBlock, '.session-panes', /overflow:\s*clip/)).toBe(
      true,
    )
  })

  it('does not make the aside a nested scroll box on mobile', () => {
    // Below 769px the panes stack and the document scrolls; a second scroll
    // box there would trap the focus target instead of revealing it.
    expect(mobileBlock).not.toBe('')
    expect(declares(mobileBlock, '.session-aside', /overflow-y:\s*auto/)).toBe(
      false,
    )
  })

  it('constrains the aside height so it can scroll at all', () => {
    expect(declares(desktopBlock, '.session-aside', /min-height:\s*0/)).toBe(
      true,
    )
  })
})

describe('trainee aside: the focus target is inside the scroll container', () => {
  it('holds the session-notes textarea in one of the asides', () => {
    const notesAside = asides.find((aside) =>
      aside.includes('id="session-notes"'),
    )
    expect(notesAside, 'no aside holds #session-notes').toBeDefined()
    expect(notesAside).toContain('<textarea')
    expect(notesAside).toMatch(/session-aside/)
  })
})

describe('design system on the aside', () => {
  it('keeps the 0px radius, no-shadow, zero-chroma register', () => {
    // The repair adds a scroll property only. Each aside keeps its width, its
    // neutral surface token, and the flat doctrine (no radius, no shadow).
    for (const tag of asideTags) {
      expect(tag).toContain('w-80')
      expect(tag).toContain('bg-card')
      expect(tag).not.toMatch(/\brounded-(?!none)/)
      expect(tag).not.toMatch(/\bshadow-/)
    }
  })

  it('adds no radius or shadow to the aside rule', () => {
    const asideRules = styleBlock
      .split('}')
      .filter((rule) => rule.includes('.session-aside'))
      .join('}')
    expect(asideRules).not.toBe('')
    expect(asideRules).not.toMatch(/border-radius/)
    expect(asideRules).not.toMatch(/box-shadow/)
  })
})
