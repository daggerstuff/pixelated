// Mobile Navigation Toggle
// Implements a sophisticated mobile menu with slide-in animation and accessibility

// Initialize mobile navigation
function initMobileNavigation() {
  // Check if mobile nav should be enabled (only on small screens)
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (!isMobile) return;

  // Find elements
  const toggleButton = document.createElement('button');
  toggleButton.className = 'mobile-nav-toggle';
  toggleButton.setAttribute('aria-label', 'Toggle navigation menu');
  toggleButton.setAttribute('aria-expanded', 'false');
  toggleButton.setAttribute('aria-controls', 'mobile-nav-menu');

  // Create menu container
  const mobileMenu = document.querySelector('.nav');
  if (!mobileMenu) return;

  // Clone the navigation menu for mobile
  const mobileMenuClone = mobileMenu.cloneNode(true);
  mobileMenuClone.id = 'mobile-nav-menu';
  mobileMenuClone.className = 'mobile-nav-menu';
  mobileMenuClone.setAttribute('aria-hidden', 'true');
  mobileMenuClone.setAttribute('tabindex', '-1');

  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'mobile-nav-backdrop';

  // Insert elements into DOM
  document.body.appendChild(backdrop);
  document.body.appendChild(mobileMenuClone);

  // Insert toggle button after the original nav
  mobileMenu.parentNode.insertBefore(toggleButton, mobileMenu.nextSibling);

  // Toggle function
  function toggleMobileMenu() {
    const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';

    if (isExpanded) {
      // Close menu
      toggleButton.setAttribute('aria-expanded', 'false');
      mobileMenuClone.setAttribute('aria-hidden', 'true');
      backdrop.classList.remove('open');
      document.body.style.overflow = '';
    } else {
      // Open menu
      toggleButton.setAttribute('aria-expanded', 'true');
      mobileMenuClone.setAttribute('aria-hidden', 'false');
      backdrop.classList.add('open');
      document.body.style.overflow = 'hidden';

      // Focus first menu item
      const firstLink = mobileMenuClone.querySelector('.nav__link');
      if (firstLink) {
        firstLink.focus();
      }
    }

    toggleButton.classList.toggle('menu-open');
    mobileMenuClone.classList.toggle('open');
  }

  // Event listeners
  toggleButton.addEventListener('click', toggleMobileMenu);

  // Close menu when clicking backdrop
  backdrop.addEventListener('click', () => {
    if (toggleButton.getAttribute('aria-expanded') === 'true') {
      toggleMobileMenu();
    }
  });

  // Close menu on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggleButton.getAttribute('aria-expanded') === 'true') {
      toggleMobileMenu();
    }
  });

  // Handle resize
  window.addEventListener('resize', () => {
    const isMobileNow = window.matchMedia('(max-width: 768px)').matches;

    if (isMobileNow) {
      // On mobile, ensure menu is closed on resize
      if (toggleButton.getAttribute('aria-expanded') === 'true') {
        toggleMobileMenu();
      }
    } else {
      // On desktop, ensure menu is closed and hidden
      if (toggleButton.getAttribute('aria-expanded') === 'true') {
        toggleMobileMenu();
      }
      // Hide toggle button on desktop
      toggleButton.style.display = 'none';
    }
  });

  // Initialize toggle button display
  toggleButton.style.display = 'flex';
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileNavigation);
} else {
  initMobileNavigation();
}