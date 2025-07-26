// Progress Bar & Image Zoom

/* nprogress */
import nprogress from 'nprogress'
document.addEventListener('astro:before-preparation', () => {
  nprogress.start()
})
document.addEventListener('astro:page-load', () => {
  nprogress.done()
})

/* medium-zoom */
import mediumZoom from 'medium-zoom/dist/pure'
const zoom = mediumZoom({
  background: 'rgb(0 0 0 / 0.8)',
})

document.addEventListener('astro:page-load', () => {
  zoom.detach()
  zoom.attach('.prose img:not(.no-zoom):not(a img)')
})
