import autoprefixer from 'autoprefixer'
import postcssImport from 'postcss-import'

export default {
  plugins: [
    // Import CSS files
    postcssImport(),

    // Add vendor prefixes
    autoprefixer({
      overrideBrowserslist: ['> 1%', 'last 2 versions', 'not dead'],
      grid: true,
      flexbox: true,
    }),

    // Custom plugin to optimize CSS custom properties
    (() => {
      return {
        postcssPlugin: 'optimize-custom-properties',
        Once(root, { result }) {
          // Optimize theme variables for better performance
          root.walkDecls((decl) => {
            // Ensure proper CSS custom property usage
            if (decl.value.includes('var(')) {
              // Validate variable references
              const varMatches = decl.value.match(/var\([^)]+\)/g)
              if (varMatches) {
                varMatches.forEach((match) => {
                  const varName = match.replace(/var\(|\)/g, '')
                  // Ensure variables are properly defined
                  if (!varName.startsWith('--')) {
                    decl.warn(
                      result,
                      `Invalid CSS custom property reference: ${varName}`,
                    )
                  }
                })
              }
            }
          })
        },
      }
    })(),

    // Plugin to validate dark theme compatibility
    (() => {
      return {
        postcssPlugin: 'validate-dark-theme',
        Once(root, { result }) {
          const darkThemeProperties = [
            '--color-void',
            '--color-primary',
            '--text-primary',
            '--accent-emerald',
            '--border-primary',
          ]

          let hasDarkTheme = false
          root.walkDecls((decl) => {
            if (darkThemeProperties.includes(decl.prop)) {
              hasDarkTheme = true
            }
          })

          if (!hasDarkTheme) {
            result.warn(
              'No dark theme properties detected. Consider importing the theme file.',
            )
          }
        },
      }
    })(),
  ],
}

// Export plugin for use in other configurations
export const darkThemeConfig = {
  browsers: ['> 1%', 'last 2 versions', 'not dead'],
  features: {
    customProperties: true,
    grid: true,
    flexbox: true,
    backdropFilter: true,
  },
}
