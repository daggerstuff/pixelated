import Viewer from 'viewerjs'

// global default config
Viewer.setDefaults({
  button: false,
  navbar: 2,
  title: [
    2,
    (img: HTMLImageElement) => {
      // prevent filling in alt with image URL when empty
      const fn = img.src.split('/').pop()?.split(/[?#]/)[0]
      return img.alt && img.alt !== fn ? img.alt : ''
    },
  ],
  toolbar: false,
  container: 'image-viewer',
  initialCoverage: 1,
  transition: false,
  zIndexInline: 300,
  filter: (image: HTMLImageElement) => {
    return (
      !image.classList.contains('no-zoom') &&
      image.parentNode?.nodeName !== 'A' &&
      image.parentNode?.parentNode?.nodeName !== 'A'
    )
  },
})

export function initImageViewer(element: HTMLElement): () => void {
  const selector = element.dataset['selector'] ?? 'img'
  const container = document.querySelector<HTMLElement>(selector)
  if (!container) return () => {}

  let userOptions = {}
  try {
    if (element.dataset['options'])
      userOptions = JSON.parse(element.dataset['options'])
  } catch (err) {
    console.error('[ImageViewer] Failed to parse options:', err)
  }

  const viewer = new Viewer(container, userOptions)
  let mutationObserver: MutationObserver | null = null
  let lastViewedImage: HTMLImageElement | null = null

  function cleanup() {
    viewer.destroy()
    mutationObserver?.disconnect()
  }

  if (element.hasAttribute('data-async-insert')) {
    mutationObserver = new MutationObserver(() => {
      const images = container.querySelectorAll(selector)
      images.forEach((img) => {
        const htmlImg = img as HTMLImageElement
        if (htmlImg !== lastViewedImage) {
          lastViewedImage = htmlImg
          viewer.update()
        }
      })
    })
    mutationObserver.observe(container, { childList: true, subtree: true })
  }

  if (element.hasAttribute('data-tab-focus')) {
    const onKeyDown = (e: KeyboardEvent) => {
      const extViewer = viewer as unknown as {
        isShown: boolean
        element: HTMLElement
      }
      if (e.key === 'Tab' && extViewer.isShown) {
        requestAnimationFrame(() => extViewer.element?.focus())
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      cleanup()
      document.removeEventListener('keydown', onKeyDown)
    }
  }

  return cleanup
}

// Auto-initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const viewers = document.querySelectorAll('image-viewer')
  viewers.forEach((viewer) => {
    initImageViewer(viewer as HTMLElement)
  })
})
