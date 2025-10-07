// Image Optimization
import { optimizeAllImages } from '../scripts/optimize-images'

// Apply image optimizations when the page loads
document.addEventListener('astro:page-load', () => {
  optimizeAllImages()
})
