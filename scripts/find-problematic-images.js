import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Create directory to store copies of problematic images
const BACKUP_DIR = path.join(__dirname, '../problematic-images-backup')
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
}

// Helper function to check if a file might be problematic
async function checkImageFile(filePath) {
  try {
    const result = execSync(`file "${filePath}"`, { encoding: 'utf8' })
    console.log(`Checking ${filePath}: ${result.trim()}`)

    // Files that claim to be images but might cause problems
    if (
      result.includes('empty') ||
      result.includes('cannot open') ||
      result.includes('ASCII text') ||
      (result.includes('data') && !result.includes('image data'))
    ) {
      console.log(`  ⚠️ Potential problematic file: ${filePath}`)

      // Create a backup of the file
      const backupPath = path.join(BACKUP_DIR, path.basename(filePath))
      fs.copyFileSync(filePath, backupPath)
      console.log(`  📦 Backed up to ${backupPath}`)

      return true
    }

    return false
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error.message)
    return true // Consider it problematic if we can't process it
  }
}

// Walk directory and find all image files
async function findProblematicImages(directory) {
  const problematicFiles = []
  const imageExtensions = [
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.svg',
    '.avif',
    '.tiff',
    '.bmp',
  ]

  function walkDir(currentPath) {
    const files = fs.readdirSync(currentPath)

    for (const file of files) {
      const filePath = path.join(currentPath, file)
      const stat = fs.statSync(filePath)

      if (
        stat.isDirectory() &&
        !filePath.includes('node_modules') &&
        !filePath.includes('.git')
      ) {
        walkDir(filePath)
      } else if (stat.isFile()) {
        const ext = path.extname(filePath).toLowerCase()
        if (imageExtensions.includes(ext) && checkImageFile(filePath)) {
          problematicFiles.push(filePath)
        }
      }
    }
  }

  walkDir(directory)
  return problematicFiles
}

// Main execution
;(async () => {
  console.log('🔍 Searching for potentially problematic image files...')
  const problematicFiles = await findProblematicImages(
    path.join(__dirname, '..'),
  )

  console.log('\n===== SUMMARY =====')
  console.log(`Found ${problematicFiles.length} potentially problematic files.`)
  console.log(`Backups stored in: ${BACKUP_DIR}`)

  if (problematicFiles.length > 0) {
    console.log(
      '\nYou may want to exclude these files from processing or convert them to a supported format.',
    )
    console.log('\nTo exclude them in astro.config.mjs, add:')
    console.log(`
compress({
  css: true,
  html: true,
  img: false,  // Keep this false to disable general image compression
  js: true,
  svg: {
    multipass: true,
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            cleanupIDs: false,
            removeViewBox: false,
          },
        },
      },
    ],
  },
  filter: [
    // Exclude problematic files
    ${problematicFiles.map((file) => `'!${file.replace(path.join(__dirname, '..'), '')}'`).join(',\n    ')}
  ]
})
`)
  }
})()
