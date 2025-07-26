/**
 * CSS Feature Fallbacks
 *
 * This script provides JavaScript fallbacks for modern CSS features
 * that don't have pure CSS fallback solutions.
 */

;(function () {
  // Check if browser supports CSS variables
  const supportsCssVars =
    window.CSS && window.CSS.supports && window.CSS.supports('(--foo: red)')

  if (!supportsCssVars) {
    console.log('CSS variables not supported - applying fallbacks')
    applyVarFallbacks()
  }

  // Check if browser supports position: sticky
  const supportsSticky =
    CSS.supports('position', 'sticky') ||
    CSS.supports('position', '-webkit-sticky')

  if (!supportsSticky) {
    console.log('Position sticky not supported - applying fallbacks')
    applyStickyFallbacks()
  }

  // Check if browser supports smooth scrolling
  const supportsScrollBehavior =
    'scrollBehavior' in document.documentElement.style

  if (!supportsScrollBehavior) {
    console.log('Smooth scrolling not supported - applying fallbacks')
    applySmoothScrollFallbacks()
  }

  // Check if browser supports text-wrap: balance
  const supportsTextWrapBalance = CSS.supports('text-wrap', 'balance')

  if (!supportsTextWrapBalance) {
    console.log('Text-wrap balance not supported - applying fallbacks')
    applyTextBalanceFallbacks()
  }

  // CSS Variables Fallback
  const applyVarFallbacks = () => {
    // Apply primary color fallbacks
    const primaryColor = '#4a9a95' // Same as in css-fallbacks.css
    const textColor = '#f3f3f3'
    const backgroundColor = '#050505'

    // Apply to elements that use these CSS variables
    document.querySelectorAll('.bg-primary').forEach((el) => {
      el.style.backgroundColor = primaryColor
    })

    document.querySelectorAll('.text-primary').forEach((el) => {
      el.style.color = primaryColor
    })

    document.querySelectorAll('.border-primary').forEach((el) => {
      el.style.borderColor = primaryColor
    })

    // Apply common text color
    document.body.style.color = textColor

    // Apply background color
    document.documentElement.style.backgroundColor = backgroundColor
    document.body.style.backgroundColor = backgroundColor
  }

  // Position Sticky Fallback
  const applyStickyFallbacks = () => {
    const stickyElements = document.querySelectorAll('.sticky')

    if (stickyElements.length === 0) {
      return
    }

    // Create a simple sticky polyfill
    window.addEventListener('scroll', function () {
      stickyElements.forEach((element) => {
        const parent = element.parentElement
        const parentRect = parent.getBoundingClientRect()
        const elementRect = element.getBoundingClientRect()
        const parentTop = parentRect.top

        // Get computed style for top offset
        const computedStyle = window.getComputedStyle(element)
        const topOffset = parseInt(computedStyle.top) || 0

        if (
          parentTop <= topOffset &&
          parentRect.bottom > elementRect.height + topOffset
        ) {
          // Add inline styles to make it "sticky"
          element.style.position = 'fixed'
          element.style.top = topOffset + 'px'
          element.style.width = parentRect.width + 'px'
        } else if (parentRect.bottom <= elementRect.height + topOffset) {
          // Stick to bottom of parent when scrolling past
          element.style.position = 'absolute'
          element.style.top = parent.offsetHeight - elementRect.height + 'px'
        } else {
          // Reset to normal positioning
          element.style.position = 'relative'
          element.style.top = '0'
        }
      })
    })
  }

  // Smooth Scroll Fallback
  const applySmoothScrollFallbacks = () => {
    // Apply smooth scrolling to all anchor links
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault()

        const targetId = this.getAttribute('href')
        if (targetId === '#') {
          return
        }

        const targetElement = document.querySelector(targetId)
        if (!targetElement) {
          return
        }

        const targetPosition =
          targetElement.getBoundingClientRect().top + window.pageYOffset
        const startPosition = window.pageYOffset
        const distance = targetPosition - startPosition
        const duration = 500 // ms
        let startTime = null

        const animation = (currentTime) => {
          if (startTime === null) {
            startTime = currentTime
          }
          const timeElapsed = currentTime - startTime
          const scrollY = ease(timeElapsed, startPosition, distance, duration)
          window.scrollTo(0, scrollY)

          if (timeElapsed < duration) {
            requestAnimationFrame(animation)
          }
        }

        // Easing function
        const ease = (t, b, c, d) => {
          t /= d / 2
          if (t < 1) {
            return (c / 2) * t * t + b
          }
          t--
          return (-c / 2) * (t * (t - 2) - 1) + b
        }

        requestAnimationFrame(animation)
      })
    })
  }

  // Text-wrap: balance fallback
  const applyTextBalanceFallbacks = () => {
    const textBalanceElements = document.querySelectorAll('.text-balance')

    textBalanceElements.forEach((element) => {
      // Simple approach: break longer paragraphs into more balanced lines
      // by inserting zero-width spaces at reasonable intervals
      const text = element.textContent
      if (text.length > 50) {
        const words = text.split(' ')
        if (words.length > 5) {
          // Add a zero-width space every few words to help with line breaking
          const result = []
          for (let i = 0; i < words.length; i++) {
            result.push(words[i])
            if (i % 4 === 3) {
              // every 4 words
              result.push('\u200B') // zero-width space
            }
          }
          element.textContent = result.join(' ')
        }
      }
    })
  }

  // Check if we need view transitions fallbacks
  if (!document.startViewTransition) {
    console.log('View transitions not supported - applying fallbacks')

    // For links using transitions, add fade-in/fade-out animations
    document.querySelectorAll('a').forEach((link) => {
      if (
        link.getAttribute('href')?.startsWith('/') &&
        !link.getAttribute('target')
      ) {
        link.addEventListener('click', function (event) {
          // Only for internal links
          if (link.hostname === window.location.hostname) {
            event.preventDefault()

            // Add exit animation to current page
            document.body.classList.add('page-exit')

            // Navigate after animation
            setTimeout(() => {
              window.location.href = link.href
            }, 300) // Match animation duration in CSS
          }
        })
      }
    })

    // Add enter animation to page
    document.body.classList.add('page-transition-fade')
  }
})()
