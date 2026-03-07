// This script injects our polyfills as a script tag in the head
export default function injectPolyfills() {
  if (typeof document !== 'undefined') {
    const script = document.createElement('script')
    script.src = '/client-polyfills.js'
    script.type = 'module'
    document.head.appendChild(script)
  }
}

// Auto-execute when this module is loaded
injectPolyfills()
