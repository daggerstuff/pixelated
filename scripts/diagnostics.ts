#!/usr/bin/env tsx

/**
 * Diagnostics script
 * Helps debug common issues with the project
 */

import fs from 'fs/promises'
import path from 'path'

const DIST_DIR = path.join(process.cwd(), 'dist')
const CLIENT_DIR = path.join(DIST_DIR, 'client')
const VERCEL_OUTPUT = path.join(process.cwd(), '.vercel/output/static')
const PAGEFIND_DIR = path.join(VERCEL_OUTPUT, 'pagefind')

// File existence check utility
async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function runDiagnostics() {
  console.log('\n🔍 Running Diagnostics\n')

  // Environment info
  console.log('📊 Environment:')
  console.log(`Node.js: ${process.version}`)
  console.log(`Platform: ${process.platform}-${process.arch}`)
  console.log(`Current directory: ${process.cwd()}`)

  try {
    // Check package manager
    console.log('\n📦 Package Manager:')
    const packageJSON = JSON.parse(await fs.readFile('package.json', 'utf-8'))
    console.log(
      `Package Manager: ${packageJSON.packageManager || 'Not specified'}`,
    )
    console.log(
      `Dependencies: ${Object.keys(packageJSON.dependencies || {}).length}`,
    )
    console.log(
      `Dev Dependencies: ${Object.keys(packageJSON.devDependencies || {}).length}`,
    )

    // Check for flexsearch
    const hasFlexsearch = !!packageJSON.dependencies?.flexsearch
    const flexsearchVersion = packageJSON.dependencies?.flexsearch
    console.log(
      `Flexsearch: ${hasFlexsearch ? `✅ (${flexsearchVersion})` : '❌ Not found'}`,
    )

    // Check for pagefind
    const hasPagefind = !!packageJSON.dependencies?.pagefind
    console.log(
      `Pagefind: ${hasPagefind ? '✅' : '⚠️ Not used (using flexsearch instead)'}`,
    )

    // Check build output
    console.log('\n🏗️ Build Output:')
    const distExists = await checkFileExists(DIST_DIR)
    console.log(`Dist directory: ${distExists ? '✅' : '❌ Not found'}`)

    if (distExists) {
      const clientExists = await checkFileExists(CLIENT_DIR)
      console.log(`Client directory: ${clientExists ? '✅' : '❌ Not found'}`)

      if (clientExists) {
        // Check for search index
        const searchIndexExists = await checkFileExists(
          path.join(CLIENT_DIR, 'search-index.js'),
        )
        console.log(
          `Search index: ${searchIndexExists ? '✅' : '❌ Not found'}`,
        )

        // Check sample HTML file
        const htmlFiles = await fs
          .readdir(CLIENT_DIR, { withFileTypes: true })
          .then((files) =>
            files.filter(
              (file) => file.isFile() && file.name.endsWith('.html'),
            ),
          )

        if (htmlFiles.length > 0) {
          const sampleHtmlPath = path.join(CLIENT_DIR, htmlFiles[0]!.name)
          const htmlContent = await fs.readFile(sampleHtmlPath, 'utf-8')
          const hasSearchScript = htmlContent.includes('search-index.js')
          console.log(
            `Search script in HTML: ${hasSearchScript ? '✅' : '❌ Not found'}`,
          )
        } else {
          console.log(`HTML files: ❌ None found`)
        }
      }
    }

    // Check Vercel output
    console.log('\n🚀 Vercel Output:')
    const vercelOutputExists = await checkFileExists(VERCEL_OUTPUT)
    console.log(
      `Vercel output directory: ${vercelOutputExists ? '✅' : '❌ Not found'}`,
    )

    if (vercelOutputExists) {
      const pagefindDirExists = await checkFileExists(PAGEFIND_DIR)
      console.log(
        `Pagefind directory: ${pagefindDirExists ? '✅' : '❓ Not found (may be created during build)'}`,
      )

      if (pagefindDirExists) {
        const pagefindJsExists = await checkFileExists(
          path.join(PAGEFIND_DIR, 'pagefind.js'),
        )
        console.log(`Pagefind.js: ${pagefindJsExists ? '✅' : '❌ Not found'}`)
      }
    }

    // Check Astro config
    console.log('\n⚙️ Astro Configuration:')
    const astroConfigExists = await checkFileExists('astro.config.mjs')
    console.log(`Astro config: ${astroConfigExists ? '✅' : '❌ Not found'}`)

    if (astroConfigExists) {
      const astroConfig = await fs.readFile('astro.config.mjs', 'utf-8')
      const usingVercel = astroConfig.includes('@astrojs/vercel')
      console.log(`Vercel adapter: ${usingVercel ? '✅' : '❌ Not found'}`)

      const nodejsRuntimeMatch = astroConfig.match(
        /runtime:\s*['"]nodejs(?<version>\d+)\.x['"]/,
      )
      const nodeRuntimeVersion = nodejsRuntimeMatch?.groups?.['version']
      console.log(
        `Node.js runtime: ${nodeRuntimeVersion ?? '❓ Not specified'}`,
      )

      const usingFlexsearch = astroConfig.includes('flexsearchIntegration')
      console.log(
        `Flexsearch integration: ${usingFlexsearch ? '✅' : '❌ Not found'}`,
      )
    }
  } catch (error) {
    console.error('\n❌ Error running diagnostics:', error)
  }

  console.log('\n✅ Diagnostics completed\n')
}

runDiagnostics().catch(console.error)
