// Scroll-Triggered Animations
// Implements performant scroll-triggered animations using Intersection Observer API
// Works with existing animation classes in advanced-animations.css

// Configuration
const ANIMATION_CLASSES = [
  'fade-in',
  'fade-in-up',
  'slide-in-left',
  'list-cascade',
  'list-wave',
  'list-spring',
  'list-morph-card',
  'feature-reveal',
  'data-row-reveal',
  'metric-counter',
  'hero-letters'
];

const OBSERVER_OPTIONS = {
  threshold: 0.15, // Trigger when 15% of element is visible
  rootMargin: '0px',
};

// Animation state tracking
const animatedElements = new Set();

// Initialize scroll animations
function initScrollAnimations() {
  // Check if IntersectionObserver is supported
  if (!('IntersectionObserver' in window)) {
    // Fallback for older browsers: animate all elements immediately
    animateAllElements();
    return;
  }

  // Create Intersection Observer
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        // Add animation classes to trigger animations
        entry.target.classList.add('animate-fade-in');

        // Add specific animation class if it matches one of our defined classes
        ANIMATION_CLASSES.forEach(className => {
          if (entry.target.classList.contains(className)) {
            entry.target.classList.add(`animate-${className}`);
          }
        });

        // Mark as animated to prevent re-animation
        animatedElements.add(entry.target);

        // Remove observer to prevent re-triggering
        observer.unobserve(entry.target);
      }
    });
  }, OBSERVER_OPTIONS);

  // Select all elements with animation classes
  const elementsToAnimate = document.querySelectorAll(
    ANIMATION_CLASSES.map(className => `.${className}`).join(', ')
  );

  // Observe all elements
  elementsToAnimate.forEach((element) => {
    // Skip if already animated
    if (animatedElements.has(element)) return;

    // Add performance optimizations
    element.classList.add('will-animate', 'gpu-accelerated');

    // Observe element
    observer.observe(element);
  });

  // Handle scroll events for initial viewport elements
  // This ensures elements already in viewport get animated
  const checkInitialElements = () => {
    elementsToAnimate.forEach((element) => {
      if (animatedElements.has(element)) return;

      const rect = element.getBoundingClientRect();
      if (rect.top <= window.innerHeight && rect.bottom >= 0) {
        // Element is in viewport
        element.classList.add('animate-fade-in');

        // Add specific animation class if it matches one of our defined classes
        ANIMATION_CLASSES.forEach(className => {
          if (element.classList.contains(className)) {
            element.classList.add(`animate-${className}`);
          }
        });

        animatedElements.add(element);
      }
    });
  };

  // Check initial elements on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkInitialElements);
  } else {
    checkInitialElements();
  }

  // Check elements on scroll
  window.addEventListener('scroll', checkInitialElements, { passive: true });
}

// Animate all elements immediately (fallback for older browsers)
function animateAllElements() {
  const elementsToAnimate = document.querySelectorAll(
    ANIMATION_CLASSES.map(className => `.${className}`).join(', ')
  );

  elementsToAnimate.forEach((element) => {
    element.classList.add('animate-fade-in');

    // Add specific animation class if it matches one of our defined classes
    ANIMATION_CLASSES.forEach(className => {
      if (element.classList.contains(className)) {
        element.classList.add(`animate-${className}`);
      }
    });

    // Add performance optimizations
    element.classList.add('will-animate', 'gpu-accelerated');
  });
}

// Respect user preferences for reduced motion
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  // Disable animations for users who prefer reduced motion
  document.documentElement.classList.add('reduced-motion');
} else {
  // Initialize animations for users who don't prefer reduced motion
  initScrollAnimations();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initScrollAnimations };
}