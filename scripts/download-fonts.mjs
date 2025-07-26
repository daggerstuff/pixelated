import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

// Get current directory (ESM equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Create fonts directory if it doesn't exist
const fontsDir = path.join(path.resolve(__dirname, '..'), 'public', 'fonts')
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true })
  console.log('Created fonts directory:', fontsDir)
}

// Font definitions with sources
const fonts = [
  {
    name: 'inter-regular.woff2',
    url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2',
  },
  {
    name: 'inter-semibold.woff2',
    url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2',
  },
  {
    name: 'inter-extrabold.woff2',
    url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiA.woff2',
  },
  {
    name: 'dm-mono-regular.woff2',
    url: 'https://fonts.gstatic.com/s/dmmono/v14/aFTU7PB1QTsUX8KYthqQBK6PYK0.woff2',
  },
  {
    name: 'dm-mono-medium.woff2',
    url: 'https://fonts.gstatic.com/s/dmmono/v14/aFTX7PB1QTsUX8KYvumzEYey_dpc.woff2',
  },
  {
    name: 'roboto-condensed-regular.woff2',
    url: 'https://fonts.gstatic.com/s/robotocondensed/v27/ieVl2ZhZI2eCN5jzbjEETS9weq8-19K7DQ.woff2',
  },
]

// Function to download a font file
function downloadFont(font) {
  return new Promise((resolve, reject) => {
    const targetPath = path.join(fontsDir, font.name)

    // Skip if file already exists
    if (fs.existsSync(targetPath)) {
      console.log(`Font already exists: ${font.name}`)
      return resolve()
    }

    console.log(`Downloading font: ${font.name}`)

    // Create write stream
    const file = fs.createWriteStream(targetPath)

    // Make the request
    https
      .get(font.url, (response) => {
        // Check if response is successful
        if (response.statusCode !== 200) {
          reject(
            new Error(
              `Failed to download ${font.name}: ${response.statusCode}`,
            ),
          )
          return
        }

        // Pipe response to file
        response.pipe(file)

        // Handle completion
        file.on('finish', () => {
          file.close()
          console.log(`✅ Downloaded: ${font.name}`)
          resolve()
        })
      })
      .on('error', (error) => {
        // Clean up on error
        fs.unlink(targetPath, () => {})
        console.error(`❌ Error downloading ${font.name}:`, error.message)
        reject(error)
      })
  })
}

// Main function to download all fonts
async function downloadAllFonts() {
  console.log('Starting font downloads...')

  try {
    // Process downloads sequentially to avoid rate limiting
    for (const font of fonts) {
      await downloadFont(font)
    }
    console.log('\n✅ All fonts downloaded successfully!')

    // Create a fallback for offline builds
    console.log('Creating font fallbacks for offline builds...')
    createFallbackFonts()

    console.log('\n🎉 Font setup complete! Your build should now work offline.')
  } catch (error) {
    console.error('\n❌ Font download process failed:', error.message)
    console.log('\n⚠️ Creating fallback system fonts...')
    createFallbackFonts()
  }
}

// Create fallback CSS for system fonts
function createFallbackFonts() {
  const fallbackCss = `/* Fallback system fonts */
:root {
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --font-condensed: Arial Narrow, Arial, sans-serif;
}
`

  const fallbackPath = path.join(fontsDir, 'fallback.css')
  fs.writeFileSync(fallbackPath, fallbackCss)
  console.log('✅ Created fallback font CSS')
}

// Run the download process
downloadAllFonts()
