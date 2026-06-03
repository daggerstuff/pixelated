/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest'

import { setupContainment, optimizeCLS } from './performance-optimization'

describe('performance-optimization', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  describe('setupContainment', () => {
    it('should add CSS contain property to matched elements', () => {
      // Setup DOM
      const el1 = document.createElement('div')
      el1.className = 'test-contain'
      document.body.appendChild(el1)

      const el2 = document.createElement('div')
      el2.className = 'test-contain'
      document.body.appendChild(el2)

      // Call function
      setupContainment('.test-contain', 'strict')

      // Assertions
      expect(el1.style.contain).toBe('strict')
      expect(el2.style.contain).toBe('strict')
    })
  })

  describe('optimizeCLS', () => {
    it('should set aspect ratio on images and iframes without dimensions', () => {
      // Setup DOM
      const imgNoDims = document.createElement('img')
      const imgWithDims = document.createElement('img')
      imgWithDims.width = 100
      imgWithDims.height = 100

      const iframeNoDims = document.createElement('iframe')
      const iframeWithDims = document.createElement('iframe')
      iframeWithDims.width = '200'
      iframeWithDims.height = '200'

      document.body.appendChild(imgNoDims)
      document.body.appendChild(imgWithDims)
      document.body.appendChild(iframeNoDims)
      document.body.appendChild(iframeWithDims)

      // Call function
      optimizeCLS()

      // Assertions
      expect(imgNoDims.style.aspectRatio).toBe('16/9')
      expect(iframeNoDims.style.aspectRatio).toBe('16/9')
      expect(imgWithDims.style.aspectRatio).toBe('')
      expect(iframeWithDims.style.aspectRatio).toBe('')
    })
  })
})
