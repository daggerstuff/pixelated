/** @vitest-environment node */

/**
 * The send control's click point is the send control (VAL-UX-002).
 *
 * Measured on `99b44142` / Worker `1f1c7586` with `agent-browser`: on
 * `/training/session/<id>` at 1440x900, `document.elementFromPoint` at the
 * centre of `#send-message` resolved to the button only until the first
 * submission. From the second submission on it resolved to nothing (the point
 * was below the viewport) and the coordinate click issued no request; at
 * 320x568 and 375x667 it was already unreachable on the first load.
 *
 * Two mechanisms, both structural:
 *
 *  1. The shell was `h-screen`, so it was 100vh tall inside a document that
 *     also carries the site header (sticky, in flow) and the site footer. The
 *     document was taller than the viewport and the composer's bottom edge sat
 *     exactly on the footer's top edge.
 *  2. Every flex column between the shell and `#messages-container` kept its
 *     automatic `min-height: auto`, so the transcript expanded to its full
 *     height (7 216px for 113 messages) instead of scrolling. The composer was
 *     pushed that far down inside the row's `overflow: hidden` box and was
 *     clipped away. A programmatic scroll (a harness's `fill`) could reach it;
 *     a pointer could not, and each new message moved it 60px further under
 *     the footer.
 *
 * Astro pages have no component test runner in this repository (see
 * `pages/training/__tests__/trainee-error-surface.test.ts`), so this is a
 * structural regression guard over the page source and its stylesheet. The
 * rendered-DOM proof is the recorded `elementFromPoint` probe plus the
 * pointer-only submissions in `results/trainee-send-control-hit-target/`; it
 * cannot be reproduced from a unit test.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const readPage = (relativePath: string): string =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')

const sessionPage = readPage('../session/[sessionId].astro')

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
 * inside a comma-separated list, which is how the transcript chain is written.
 */
const declares = (
  block: string,
  selector: string,
  declaration: RegExp,
): boolean => {
  const rule = /([^{}]+)\{([^{}]*)\}/g
  // Comments sit between rules and would otherwise join the selector list.
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

/** The composer block: the container that holds the textarea and the button. */
const composer = (() => {
  const start = sessionPage.indexOf('<div class="border-t border-border p-4')
  const end = sessionPage.indexOf('</main>', start)
  return start === -1 ? '' : sessionPage.slice(start, end)
})()

const sendButton = (() => {
  const start = sessionPage.indexOf('id="send-message"')
  const end = sessionPage.indexOf('</button>', start)
  return start === -1 ? '' : sessionPage.slice(start, end)
})()

describe('training session shell: fits the viewport it is drawn in', () => {
  it('no longer sizes the shell to a full viewport inside the site layout', () => {
    // The pinned page used `h-screen`, which is 100vh measured from the top of
    // the document — but the shell starts below the sticky site header.
    expect(sessionPage).not.toMatch(/class="h-screen/)
    expect(sessionPage).toMatch(/class="session-shell flex flex-col/)
  })

  it('lets the shell take the space between the header and the footer', () => {
    expect(desktopBlock).not.toBe('')
    // A viewport-height column: header, content, footer.
    expect(declares(desktopBlock, ':global(body)', /display:\s*flex/)).toBe(
      true,
    )
    expect(
      declares(desktopBlock, ':global(body)', /flex-direction:\s*column/),
    ).toBe(true)
    expect(declares(desktopBlock, ':global(body)', /height:\s*100dvh/)).toBe(
      true,
    )
    // The layout's own <main> becomes the flexible middle.
    expect(
      declares(desktopBlock, ':global(main#main-content)', /flex:\s*1 1 auto/),
    ).toBe(true)
    expect(
      declares(desktopBlock, ':global(main#main-content)', /min-height:\s*0/),
    ).toBe(true)
    expect(declares(desktopBlock, '.session-shell', /flex:\s*1 1 auto/)).toBe(
      true,
    )
    expect(declares(desktopBlock, '.session-shell', /min-height:\s*0/)).toBe(
      true,
    )
  })
})

describe('training session transcript: scrolls instead of pushing the composer', () => {
  it('constrains every flex column between the shell and the transcript', () => {
    expect(sessionPage).toMatch(/session-column/)
    expect(sessionPage).toMatch(/session-transcript/)
    expect(sessionPage).toMatch(/session-messages/)

    for (const selector of [
      '.session-panes',
      '.session-column',
      '.session-transcript',
      '.session-messages',
    ]) {
      expect(
        declares(desktopBlock, selector, /min-height:\s*0/),
        `${selector} must not keep its automatic min-height`,
      ).toBe(true)
    }
  })

  it('keeps the transcript a scroll container', () => {
    expect(sessionPage).toMatch(/id="messages-container"/)
    expect(sessionPage).toMatch(/overflow-y-auto/)
  })

  it('makes the row a clipping box that cannot be scrolled', () => {
    // `overflow: hidden` is still a scroll container: focus and scrollIntoView
    // scroll it, which is how the harness reached a composer a pointer could
    // not. `clip` is not scrollable at all.
    expect(sessionPage).not.toMatch(/flex-1 flex overflow-hidden/)
    expect(sessionPage).toMatch(/flex-1 flex session-panes/)
    expect(declares(desktopBlock, '.session-panes', /overflow:\s*clip/)).toBe(
      true,
    )
  })
})

describe('training session layout at 320px', () => {
  it('stacks and scrolls the document instead of clipping the composer', () => {
    expect(mobileBlock).not.toBe('')
    // The shell is content-height everywhere; only the desktop block pins it
    // into the header/footer column.
    expect(declares(styleBlock, '.session-shell', /height:\s*auto/)).toBe(true)
    expect(declares(mobileBlock, '.session-panes', /overflow:\s*visible/)).toBe(
      true,
    )
  })
})

describe('design system on the composer', () => {
  it('keeps 0px radius and no shadow', () => {
    expect(composer).not.toBe('')
    expect(composer).not.toMatch(/\brounded-(?!none)/)
    expect(composer).not.toMatch(/\bshadow-/)
  })

  it('keeps a 44px send target', () => {
    // px-6 py-3 around a 20px icon: 24px of padding plus the glyph clears the
    // 44px floor at every width (measured 128px desktop, 44px at 320px).
    expect(sendButton).toMatch(/px-6 py-3/)
    expect(sendButton).toMatch(/w-5 h-5/)
  })
})
