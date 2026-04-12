// Progress Bar & Image Zoom

const nprogressPromise =
  import('https://cdn.jsdelivr.net/npm/nprogress@0.2.0/+esm').catch(() => null)
const mediumZoomPromise =
  import('https://cdn.jsdelivr.net/npm/medium-zoom@1.1.0/+esm').catch(
    () => null,
  )

function resolveDefaultExport(module) {
  if (!module) return null
  if (module.default) return module.default
  if (typeof module === 'function') return module
  return null
}

document.addEventListener('astro:before-preparation', async () => {
  const nprogressModule = resolveDefaultExport(await nprogressPromise)
  if (nprogressModule?.start) {
    nprogressModule.start()
  }
})

document.addEventListener('astro:page-load', async () => {
  const nprogressModule = resolveDefaultExport(await nprogressPromise)
  if (nprogressModule?.done) {
    nprogressModule.done()
  }

  const mediumZoomModule = resolveDefaultExport(await mediumZoomPromise)
  if (!mediumZoomModule) return
  const zoom = mediumZoomModule({
    background: 'rgb(0 0 0 / 0.8)',
  })
  zoom.detach()
  zoom.attach('.prose img:not(.no-zoom):not(a img)')
})
