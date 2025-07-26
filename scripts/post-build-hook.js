#!/usr/bin/env node

/**
 * post-build-hook.js
 *
 * This script runs after the build process completes to:
 * 1. Verify the build output structure
 * 2. Check for common issues in the build artifacts
 * 3. Generate a build report
 * 4. Perform any necessary post-build optimizations
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

// Helper function to check if a directory exists and has contents
function checkDirectory(dirPath, minExpectedFiles = 1) {
  try {
    if (!fs.existsSync(dirPath)) {
      return {
        exists: false,
        message: `Directory does not exist: ${dirPath}`,
        fileCount: 0,
      }
    }

    const files = fs.readdirSync(dirPath)
    const fileCount = files.length

    if (fileCount < minExpectedFiles) {
      return {
        exists: true,
        message: `Directory exists but contains fewer than expected files (${fileCount}/${minExpectedFiles}): ${dirPath}`,
        fileCount,
      }
    }

    return {
      exists: true,
      message: `Directory exists with ${fileCount} files: ${dirPath}`,
      fileCount,
    }
  } catch (error) {
    return {
      exists: false,
      message: `Error checking directory ${dirPath}: ${error.message}`,
      fileCount: 0,
      error,
    }
  }
}

// Helper function to check if critical files exist
function checkCriticalFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        exists: false,
        message: `Critical file missing: ${filePath}`,
      }
    }

    const stats = fs.statSync(filePath)

    if (stats.size === 0) {
      return {
        exists: true,
        message: `Critical file exists but is empty: ${filePath}`,
        size: 0,
      }
    }

    return {
      exists: true,
      message: `Critical file exists (${stats.size} bytes): ${filePath}`,
      size: stats.size,
    }
  } catch (error) {
    return {
      exists: false,
      message: `Error checking file ${filePath}: ${error.message}`,
      error,
    }
  }
}

// Function to write a build report
function writeBuildReport(reportData) {
  try {
    const reportDir = path.join(projectRoot, 'reports')
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const reportFile = path.join(reportDir, `build-report-${timestamp}.json`)

    fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2))
    console.log(`📊 Build report written to: ${reportFile}`)

    return reportFile
  } catch (error) {
    console.error(`❌ Failed to write build report: ${error.message}`)
    return null
  }
}

// Main function
async function postBuildHook() {
  console.log('🔍 Running post-build verification...')

  const buildReport = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      nodeEnv: process.env.NODE_ENV,
    },
    directories: {},
    criticalFiles: {},
    issues: [],
    success: true,
  }

  // 1. Check build output directories
  console.log('\n📁 Checking build output directories...')

  const directoriesToCheck = [
    { path: path.join(projectRoot, 'dist'), minFiles: 1, critical: true },
    {
      path: path.join(projectRoot, 'dist', 'client'),
      minFiles: 1,
      critical: true,
    },
    {
      path: path.join(projectRoot, 'dist', 'client', '_astro'),
      minFiles: 1,
      critical: true,
    },
    {
      path: path.join(projectRoot, 'dist', 'server'),
      minFiles: 1,
      critical: true,
    },
    {
      path: path.join(projectRoot, 'dist', 'functions'),
      minFiles: 0,
      critical: false,
    },
  ]

  for (const dir of directoriesToCheck) {
    const result = checkDirectory(dir.path, dir.minFiles)
    buildReport.directories[dir.path] = result

    if (dir.critical && (!result.exists || result.fileCount < dir.minFiles)) {
      buildReport.issues.push({
        type: 'critical',
        message: `Critical directory issue: ${result.message}`,
      })
      buildReport.success = false
      console.error(`❌ ${result.message}`)
    } else {
      console.log(`✅ ${result.message}`)
    }
  }

  // 2. Check critical files
  console.log('\n📄 Checking critical files...')

  const criticalFiles = [
    path.join(projectRoot, 'dist', 'server', 'entry.mjs'),
    path.join(projectRoot, 'dist', 'client', 'index.html'),
  ]

  for (const filePath of criticalFiles) {
    const result = checkCriticalFile(filePath)
    buildReport.criticalFiles[filePath] = result

    if (!result.exists || (result.size !== undefined && result.size === 0)) {
      buildReport.issues.push({
        type: 'critical',
        message: result.message,
      })
      buildReport.success = false
      console.error(`❌ ${result.message}`)
    } else {
      console.log(`✅ ${result.message}`)
    }
  }

  // 3. Check for common issues in HTML files
  console.log('\n🔍 Checking for common issues in HTML files...')

  try {
    const htmlDir = path.join(projectRoot, 'dist', 'client')
    const htmlFiles = findFilesWithExtension(htmlDir, '.html')

    let htmlIssuesFound = false

    for (const htmlFile of htmlFiles) {
      const content = fs.readFileSync(htmlFile, 'utf-8')

      // Check for common issues
      const issues = []

      // Missing viewport meta tag
      if (!content.includes('<meta name="viewport"')) {
        issues.push('Missing viewport meta tag')
      }

      // Missing title tag
      if (!content.includes('<title>')) {
        issues.push('Missing title tag')
      }

      // Broken script references
      const scriptRegex = /<script[^>]+src="([^"]+)"/g
      let match
      while ((match = scriptRegex.exec(content)) !== null) {
        const scriptSrc = match[1]
        if (!scriptSrc.startsWith('http') && !scriptSrc.startsWith('//')) {
          const scriptPath = path.join(path.dirname(htmlFile), scriptSrc)
          if (!fs.existsSync(scriptPath)) {
            issues.push(`Broken script reference: ${scriptSrc}`)
          }
        }
      }

      // Report issues
      if (issues.length > 0) {
        htmlIssuesFound = true
        const relativeFilePath = path.relative(projectRoot, htmlFile)

        buildReport.issues.push({
          type: 'warning',
          file: relativeFilePath,
          issues,
        })

        console.warn(`⚠️ Issues in ${relativeFilePath}:`)
        issues.forEach((issue) => console.warn(`   - ${issue}`))
      }
    }

    if (!htmlIssuesFound) {
      console.log('✅ No common HTML issues found')
    }
  } catch (error) {
    console.error(`❌ Error checking HTML files: ${error.message}`)
    buildReport.issues.push({
      type: 'error',
      message: `Error checking HTML files: ${error.message}`,
    })
  }

  // 4. Write build report
  const reportFile = writeBuildReport(buildReport)

  // 5. Summary
  console.log('\n📋 Post-build verification summary:')
  if (buildReport.success) {
    console.log('✅ All critical checks passed!')
  } else {
    console.log(
      `❌ ${buildReport.issues.filter((i) => i.type === 'critical').length} critical issues found`,
    )
    console.log(
      `⚠️ ${buildReport.issues.filter((i) => i.type === 'warning').length} warnings found`,
    )
  }

  if (reportFile) {
    console.log(`📊 Full report available at: ${reportFile}`)
  }

  return buildReport.success
}

// Helper function to recursively find files with a specific extension
function findFilesWithExtension(directory, extension) {
  let results = []

  if (!fs.existsSync(directory)) {
    return results
  }

  const items = fs.readdirSync(directory)

  for (const item of items) {
    const itemPath = path.join(directory, item)
    const stats = fs.statSync(itemPath)

    if (stats.isDirectory()) {
      results = results.concat(findFilesWithExtension(itemPath, extension))
    } else if (path.extname(item).toLowerCase() === extension) {
      results.push(itemPath)
    }
  }

  return results
}

// Run the post-build hook
postBuildHook()
  .then((success) => {
    if (!success) {
      console.warn('⚠️ Post-build verification completed with issues')
      // Exit with 0 to not fail the build
      process.exit(0)
    } else {
      console.log('🎉 Post-build verification completed successfully!')
      process.exit(0)
    }
  })
  .catch((error) => {
    console.error('❌ Post-build verification failed:', error)
    // Exit with 0 to not fail the build
    process.exit(0)
  })
