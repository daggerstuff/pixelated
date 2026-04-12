const P5_CDN_URL = 'https://cdn.jsdelivr.net/npm/p5@2.0.3/lib/p5.min.js'
const P5_CDN_INTEGRITY =
  'sha384-+QwQ6Q0imeISFRCGDpa2BkLomqKgJo0vvArkH5AO9M/dwZ0pniS3pSkeCZMt2rtI'
const P5_SCRIPT_ATTR = 'data-pixelated-p5-loader'

/** @type {Promise<unknown> | null} */
let p5Promise = null

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function getExistingP5Script() {
  return document.querySelector(
    `script[src="${P5_CDN_URL}"], script[${P5_SCRIPT_ATTR}]`,
  )
}

/**
 * @returns {Promise<unknown>}
 */
async function createP5Loader() {
  if (typeof window.p5 !== 'undefined') {
    return window.p5
  }

  const script =
    getExistingP5Script() ??
    (() => {
      const created = document.createElement('script')
      created.src = P5_CDN_URL
      created.integrity = P5_CDN_INTEGRITY
      created.crossOrigin = 'anonymous'
      created.setAttribute(P5_SCRIPT_ATTR, 'true')
      return created
    })()

  if (!script.isConnected) {
    document.head.appendChild(script)
  }

  return await new Promise((resolve, reject) => {
    script.addEventListener(
      'load',
      () => {
        if (typeof window.p5 === 'undefined') {
          reject(new Error('p5.js loaded without exposing window.p5'))
          return
        }
        resolve(window.p5)
      },
      { once: true },
    )
    script.addEventListener(
      'error',
      () => {
        reject(new Error(`Failed to load p5.js from ${P5_CDN_URL}`))
      },
      { once: true },
    )
  })
}

/** @returns {Promise<unknown>} */
export default async function loadP5() {
  if (!isBrowser()) {
    throw new Error('loadP5 can only be called in a browser environment')
  }

  p5Promise ??= createP5Loader().catch((error) => {
    p5Promise = null
    throw error
  })

  return p5Promise
}
