/**
 * Shiki-based syntax highlighter to replace PrismJS
 *
 * This file provides a syntax highlighting solution using Shiki instead of PrismJS,
 * which avoids the DOM Clobbering vulnerability (CVE-2024-53382) present in PrismJS.
 */

import { getHighlighter } from 'shiki'

// Initialize the highlighter with a default theme
let highlighterPromise = getHighlighter({
  theme: 'vitesse-dark',
  langs: [
    'javascript',
    'typescript',
    'jsx',
    'tsx',
    'html',
    'css',
    'json',
    'markdown',
    'yaml',
    'bash',
    'shell',
  ],
})

/**
 * Highlight code with Shiki
 * @param {string} code - The code to highlight
 * @param {string} lang - The language of the code
 * @returns {Promise<string>} - The highlighted HTML
 */
export async function highlight(code, lang = 'text') {
  const highlighter = await highlighterPromise
  return highlighter.codeToHtml(code, { lang })
}

/**
 * Highlight code synchronously (falls back to basic HTML escaping if highlighter is not ready)
 * @param {string} code - The code to highlight
 * @param {string} lang - The language of the code
 * @returns {string} - The highlighted HTML or escaped code
 */
export function highlightSync(code, lang = 'text') {
  // Basic HTML escaping as fallback
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  return `<pre class="language-${lang}"><code class="language-${lang}">${escaped}</code></pre>`
}

/**
 * Set the theme for the highlighter
 * @param {string} theme - The theme to use
 */
export async function setTheme(theme) {
  highlighterPromise = getHighlighter({
    theme,
    langs: [
      'javascript',
      'typescript',
      'jsx',
      'tsx',
      'html',
      'css',
      'json',
      'markdown',
      'yaml',
      'bash',
      'shell',
    ],
  })
}

// Export a default object for compatibility with PrismJS imports
export default {
  highlight: highlightSync,
  highlightAll: () => {
    console.warn('highlightAll is not supported in the Shiki-based highlighter')
  },
  languages: {},
  hooks: { all: {} },
}
