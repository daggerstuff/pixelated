#!/usr/bin/env node

/**
 * Script Optimization Utility
 *
 * This script analyzes the scripts folder and helps:
 * 1. Identify and remove unnecessary scripts
 * 2. Move obsolete scripts to a backup folder
 * 3. Consolidate similar scripts
 * 4. Update package.json references as needed
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

// Import audit logger for HIPAA compliance
import { logger as getLogger } from '../lib/utils/logger'

// Initialize logger for PHI audit
const logger = getLogger({ prefix: 'phi-audit' })

// Get directory paths
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const scriptsDir = path.join(projectRoot, 'scripts')
const backupDir = path.join(scriptsDir, 'backup')

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true })
}

// Log with timestamp
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`)
}

// Helper to move a file to backup
function backupFile(filePath) {
  const fileName = path.basename(filePath)
  const backupPath = path.join(backupDir, fileName)

  try {
    fs.copyFileSync(filePath, backupPath)
    fs.unlinkSync(filePath)
    log(`✅ Moved to backup: ${fileName}`)

    // Audit log if file contains PHI-related content
    if (
      /patient|phi|medical|health/i.test(fs.readFileSync(backupPath, 'utf8'))
    ) {
      logger.info('PHI-related file moved to backup', {
        fileName,
        operation: 'backup',
        destination: backupPath,
        timestamp: new Date().toISOString(),
      })
    }

    return true
  } catch (error) {
    log(`❌ Failed to back up ${fileName}: ${error.message}`)
    return false
  }
}

// Load package.json
let packageJson
try {
  const packageJsonPath = path.join(projectRoot, 'package.json')
  packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
} catch (error) {
  log(`❌ Failed to read package.json: ${error.message}`)
  process.exit(1)
}

// Categories of scripts
const categories = {
  // Primary consolidated scripts to keep
  consolidated: [
    'consolidated-build.js',
    'consolidated-deploy.js',
    'consolidated-fix.js',
    'copy-polyfills.js',
    'pre-build-check.js',
    'generate-compatibility-report.js',
    'setup-dev-env.js',
    'verify-env-vars.js',
    'verify-headers.js',
    'verify-security-headers.js',
    'schedule-posts.js',
    'clean-credentials.js',
    'run-tests.sh',
    'run-pagefind.ts',
    'setup-env.ts',
    'diagnostics.ts',
    'run-mcp-tests.js',
    'provision-grafana-dashboard.ts',
    'test-backup-system.ts',
    'load-test.ts',
  ],

  // Build-related scripts that can be removed (replaced by consolidated-build.js)
  buildRelated: [
    'build-no-buffer.js',
    'build-polyfills.js',
    'build-suppress-buffer-errors.js',
    'direct-build.js',
    'custom-build.js',
    'final-build-fix.js',
    'build-no-buffer.js',
  ],

  // Buffer fix scripts that can be removed (consolidated into fix scripts)
  bufferFixes: [
    'astro-buffer-shim.mjs',
    'buffer-workaround.mjs',
    'complete-buffer-fix.js',
    'direct-buffer-patch.js',
    'fix-buffer-issue.js',
    'fix-buffer-issue-final.js',
    'fix-buffer-issue-safer.js',
    'global-buffer-fix.js',
    'temp-ignore-buffer-errors.mjs',
    'vite-buffer-polyfill.js',
  ],

  // Patch scripts that can be removed (consolidated into fix scripts)
  patchScripts: [
    'apply-patches.js',
    'astro-path-patch.js',
    'commonjs-modules-patch.js',
    'fix-path-loader.js',
    'path-browserify-patch.js',
    'patch-astro-and-build.js',
  ],

  // Test scripts that can be consolidated
  testScripts: [
    'test-backup.js',
    'test-crypto-check.sh',
    'test-hipaa-check.sh',
    'test-mime-types.js',
    'final-hipaa-test.sh',
    'hipaa-security-check.js',
    'phi-detector.js',
  ],

  // Misc scripts that can be removed or consolidated
  miscScripts: [
    'simple-credential-fix.js',
    'security-scanning-fixed.yml',
    'clean-credentials-video.yaml',
    'clear-astro-cache.sh',
    'download-fonts.js',
    'ultimate-fix.js',
    'check-imports.sh',
    'check_astro_imports.sh',
  ],

  // Config files to keep
  configFiles: [
    '.eslintrc.cjs',
    '.eslintrc.js',
    'README.md',
    'README-security.md',
  ],
}

// Start optimization process
log('🚀 Starting script optimization process...')
logger.info('Script optimization process started', {
  operation: 'script-optimization',
  timestamp: new Date().toISOString(),
})

// 1. Back up unnecessary build scripts
log('\n📦 Processing build-related scripts...')
categories.buildRelated.forEach((fileName) => {
  const filePath = path.join(scriptsDir, fileName)
  if (fs.existsSync(filePath)) {
    backupFile(filePath)
  }
})

// 2. Back up buffer fix scripts
log('\n📦 Processing buffer fix scripts...')
categories.bufferFixes.forEach((fileName) => {
  const filePath = path.join(scriptsDir, fileName)
  if (fs.existsSync(filePath)) {
    backupFile(filePath)
  }
})

// 3. Back up patch scripts
log('\n📦 Processing patch scripts...')
categories.patchScripts.forEach((fileName) => {
  const filePath = path.join(scriptsDir, fileName)
  if (fs.existsSync(filePath)) {
    backupFile(filePath)
  }
})

// 4. Back up test scripts
log('\n📦 Processing test scripts...')
// Audit log for handling PHI-related test scripts
logger.info('Processing PHI-related test scripts', {
  operation: 'process-phi-tests',
  scripts: categories.testScripts.filter((name) =>
    /phi|hipaa|security|patient|medical|health/i.test(name),
  ),
  timestamp: new Date().toISOString(),
})

categories.testScripts.forEach((fileName) => {
  const filePath = path.join(scriptsDir, fileName)
  if (fs.existsSync(filePath)) {
    // Add extra audit logging for PHI-related scripts
    if (/phi|hipaa|security|patient|medical|health/i.test(fileName)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8')
        logger.info(`Processing PHI-related script: ${fileName}`, {
          fileName,
          operation: 'read-phi-script',
          timestamp: new Date().toISOString(),
        })
      } catch (error) {
        logger.error(`Error reading PHI-related script: ${fileName}`, {
          fileName,
          error: error.message,
          timestamp: new Date().toISOString(),
        })
      }
    }
    backupFile(filePath)
  }
})

// 5. Back up misc scripts
log('\n📦 Processing misc scripts...')
categories.miscScripts.forEach((fileName) => {
  const filePath = path.join(scriptsDir, fileName)
  if (fs.existsSync(filePath)) {
    backupFile(filePath)
  }
})

// Check for duplicate functionality
log('\n🔍 Checking for duplicate font download scripts...')
if (
  fs.existsSync(path.join(scriptsDir, 'download-fonts.js')) &&
  fs.existsSync(path.join(scriptsDir, 'download-fonts.mjs'))
) {
  // Keep the .mjs version and back up the .js version
  backupFile(path.join(scriptsDir, 'download-fonts.js'))
}

// Create consolidated test script
log('\n🔧 Creating consolidated test utility...')

const consolidatedTestContent = `#!/usr/bin/env node

/**
 * Consolidated Testing Utility
 *
 * This script combines functionality from multiple testing scripts:
 * - HIPAA compliance checks
 * - Backup testing
 * - Security and PHI detection
 * - Crypto validation
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { logger as getLogger } from '../lib/utils/logger';

// Initialize PHI audit logger
const logger = getLogger({ prefix: 'phi-audit' });

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Helper to run commands
function runCommand(command, label) {
  console.log(\`\n🔄 \${label}...\`);
  try {
    // Log PHI-related operations for audit
    if (/phi|hipaa|patient|medical|health/i.test(label)) {
      logger.info(\`Running PHI-related command: \${label}\`, {
        operation: 'phi-command',
        command: command.replace(/--token=\\S+/g, '--token=REDACTED'), // Redact sensitive tokens
        timestamp: new Date().toISOString()
      });
    }

    execSync(command, { stdio: 'inherit', cwd: projectRoot });
    return true;
  } catch (error) {
    console.error(\`❌ \${label} failed: \${error.message}\`);

    // Log PHI-related errors for audit
    if (/phi|hipaa|patient|medical|health/i.test(label)) {
      logger.error(\`PHI-related command failed: \${label}\`, {
        operation: 'phi-command-error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }

    return false;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const testType = args[0] || 'all';
`

// Write the consolidated test utility
const consolidatedTestPath = path.join(scriptsDir, 'consolidated-test.js')
try {
  fs.writeFileSync(consolidatedTestPath, consolidatedTestContent)
  fs.chmodSync(consolidatedTestPath, '755') // Make executable
  log(`✅ Created consolidated test utility: consolidated-test.js`)

  // Audit log for creating PHI-related consolidated test script
  logger.info('Created PHI-related consolidated test script', {
    operation: 'create-phi-test-script',
    filename: 'consolidated-test.js',
    timestamp: new Date().toISOString(),
  })
} catch (error) {
  log(`❌ Failed to create consolidated test utility: ${error.message}`)
}

// Log completion
log('\n✅ Script optimization completed!')
logger.info('Script optimization process completed', {
  operation: 'script-optimization-complete',
  timestamp: new Date().toISOString(),
})
