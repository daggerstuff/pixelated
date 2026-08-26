// Force dark mode as default
;(function () {
  // Check if theme is already set in localStorage
  const theme = localStorage.getItem('theme')

  // If no theme is set, force dark mode
  if (!theme) {
    localStorage.setItem('theme', 'dark')
    document.documentElement.classList.add('dark')
  } else if (theme === 'dark') {
    // Ensure dark class is applied if theme is dark
    document.documentElement.classList.add('dark')
  }

  // Fix layout issues by adding viewport meta tag if not present
  if (!document.querySelector('meta[name="viewport"]')) {
    const metaViewport = document.createElement('meta')
    metaViewport.name = 'viewport'
    metaViewport.content =
      'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover'
    document.head.appendChild(metaViewport)
  }

  // Add a class to ensure proper spacing and layout
  document.documentElement.classList.add('layout-fixed')

  // Log that the script ran
  console.log('Dark mode and layout script initialized')
})()
