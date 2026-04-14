#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const TEXT_EXTENSIONS = new Set([
  '.astro',
  '.bash',
  '.cjs',
  '.conf',
  '.css',
  '.env',
  '.html',
  '.ini',
  '.js',
  '.json',
  '.jsx',
  '.mjs',
  '.py',
  '.sh',
  '.sql',
  '.svg',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
  '.zsh',
])

const IGNORED_DIRS = new Set([
  '.astro',
  '.git',
  '.moderne',
  '.next',
  '.nuxt',
  '.output',
  '.pnpm-store',
  '.venv',
  '__tests__',
  '__mocks__',
  'coverage',
  'dist',
  'docs',
  'htmlcov',
  'node_modules',
  'playwright-report',
  'test-results',
  'tests',
  'fixtures',
  '__pycache__',
])

const LOCK_FILES = new Set([
  'Cargo.lock',
  'go.sum',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
])

const SECRET_PATTERNS = [
  {
    name: 'AWS access key',
    severity: 'critical',
    regex: /AKIA[0-9A-Z]{16}/g,
  },
  {
    name: 'GitHub token',
    severity: 'critical',
    regex: /\b(?:ghp|gho|ghs|ghr)_[0-9A-Za-z]{36}\b/g,
  },
  {
    name: 'GitHub fine-grained PAT',
    severity: 'critical',
    regex: /\bgithub_pat_[0-9A-Za-z_]{82}\b/g,
  },
  {
    name: 'Google API key',
    severity: 'high',
    regex: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    name: 'Slack token',
    severity: 'high',
    regex: /\bxox[baprs]-[0-9]{10,}-[0-9A-Za-z-]+\b/g,
  },
  {
    name: 'Stripe live secret',
    severity: 'critical',
    regex: /\bsk_live_[0-9A-Za-z]{24,}\b/g,
  },
  {
    name: 'Connection string',
    severity: 'high',
    regex:
      /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|amqp|mssql):\/\/[^/\s:@'"`]+:[^@\s'"`]+@[^\s'"`]{4,}/g,
  },
  {
    name: 'Generic secret assignment',
    severity: 'high',
    regex:
      /\b(?:secret|token|password|passwd|pwd|api[_-]?key|apikey|access[_-]?key|auth[_-]?token|client[_-]?secret)\b[^\n:=]{0,30}[:=]\s*['"`][A-Za-z0-9_/+=~.-]{16,}['"`]/gi,
  },
  {
    name: 'Private key block',
    severity: 'critical',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g,
  },
  {
    name: 'JWT token',
    severity: 'medium',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
]

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/')
}

function shouldIgnoreDir(dirName) {
  return IGNORED_DIRS.has(dirName) || dirName.startsWith('.pytest_cache')
}

function shouldScanFile(filePath) {
  const basename = path.basename(filePath)

  if (LOCK_FILES.has(basename)) {
    return false
  }

  if (basename === 'Dockerfile' || basename.startsWith('Dockerfile.')) {
    return true
  }

  return TEXT_EXTENSIONS.has(path.extname(basename))
}

function looksLikePlaceholder(value) {
  return /example|placeholder|dummy|fake|mock|changeme|replace[_-]?me|test[_-]?key|sample/i.test(
    value,
  )
}

function isSafeLine(line) {
  return (
    line.includes('process.env') ||
    line.includes('import.meta.env') ||
    line.includes('os.environ') ||
    line.includes('os.getenv') ||
    line.includes('getEnvVar(') ||
    line.includes('${') ||
    line.includes('${{') ||
    line.includes('secrets.') ||
    line.includes('vars.')
  )
}

function shouldIgnoreMatch(line, match, patternName) {
  if (patternName === 'Connection string') {
    return (
      match.includes('${') ||
      /localhost|127\.0\.0\.1|redis:6379|postgres:5432/i.test(match)
    )
  }

  if (patternName === 'Generic secret assignment') {
    return /:\s*['"][A-Z0-9_]{8,}['"],?\s*$/.test(line)
  }

  return false
}

function redactMatch(match) {
  if (match.length <= 12) {
    return '[REDACTED]'
  }

  return `${match.slice(0, 4)}...${match.slice(-4)}`
}

function redactLine(line, match) {
  return line.replaceAll(match, redactMatch(match)).trim()
}

function scanFile(rootDir, filePath) {
  const relativePath = normalizePath(path.relative(rootDir, filePath))
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split(/\r?\n/)
  const findings = []

  lines.forEach((line, index) => {
    if (!line.trim() || isSafeLine(line)) {
      return
    }

    SECRET_PATTERNS.forEach(({ name, severity, regex }) => {
      const matches = [...line.matchAll(new RegExp(regex.source, regex.flags))]

      matches.forEach(([match]) => {
        if (!match || looksLikePlaceholder(match)) {
          return
        }

        if (shouldIgnoreMatch(line, match, name)) {
          return
        }

        findings.push({
          file: relativePath,
          line: index + 1,
          severity,
          message: `${name} detected`,
          code: redactLine(line, match),
        })
      })
    })
  })

  return findings
}

function walk(rootDir, currentDir, findings) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true })

  entries.forEach((entry) => {
    const fullPath = path.join(currentDir, entry.name)

    if (entry.isDirectory()) {
      if (shouldIgnoreDir(entry.name)) {
        return
      }

      walk(rootDir, fullPath, findings)
      return
    }

    if (entry.isFile() && shouldScanFile(fullPath)) {
      findings.push(...scanFile(rootDir, fullPath))
    }
  })
}

export function scanDirectory(targetDir = '.', options = {}) {
  const rootDir = path.resolve(options.cwd ?? process.cwd(), targetDir)
  const findings = []

  if (!fs.existsSync(rootDir)) {
    return findings
  }

  const stat = fs.statSync(rootDir)
  if (stat.isFile()) {
    return shouldScanFile(rootDir) ? scanFile(path.dirname(rootDir), rootDir) : findings
  }

  walk(rootDir, rootDir, findings)
  return findings
}
