#!/usr/bin/env node
// Minimal tag-manager.js for rollback workflow
const { execFileSync } = require('child_process')
const args = process.argv.slice(2)

function usage() {
  console.log(
    'Usage: node tag-manager.js <validate|create|list|cleanup> <env> [--message="msg"] [--push]',
  )
  process.exit(1)
}

if (args.length < 2) {
  usage()
}
const command = args[0]
const env = args[1]
if (!['staging', 'production'].includes(env)) {
  usage()
}

function getTags(pattern) {
  try {
    const tags = execFileSync(
      'git',
      ['tag', '-l', pattern, '--sort=-committerdate'],
      {
        encoding: 'utf8',
      },
    )
    return tags.split('\n').filter(Boolean)
  } catch {
    return []
  }
}

if (command === 'validate') {
  const tags = getTags(`${env}-*`)
  if (tags.length >= 2) {
    process.exit(0)
  } else {
    process.exit(1)
  }
}

if (command === 'list') {
  const tags = getTags(`${env}-*`)
  for (const t of tags) {
    console.log(t)
  }
  process.exit(0)
}

if (command === 'cleanup') {
  const tags = getTags(`${env}-*`)
  // Keep the 2 most recent tags (rollback needs a pair); delete the rest
  const stale = tags.slice(2)
  for (const t of stale) {
    try {
      execFileSync('git', ['tag', '-d', t])
      console.log(`Deleted tag: ${t}`)
    } catch (e) {
      console.error(`Failed to delete tag ${t}: ${e.message}`)
    }
  }
  console.log(`Cleanup complete: deleted ${stale.length}, kept ${Math.min(tags.length, 2)}`)
  process.exit(0)
}

if (command === 'create') {
  // Parse message and push
  let message = ''
  let push = false
  for (let i = 2; i < args.length; i++) {
    if (args[i].startsWith('--message=')) {
      message = args[i].replace('--message=', '')
    }
    if (args[i] === '--push') {
      push = true
    }
  }
  // Millisecond precision + uniqueness loop: same-second creates must not collide
  let tagName = `${env}-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 17)}`
  const existing = getTags(`${env}-*`)
  let suffix = 1
  while (existing.includes(tagName)) {
    tagName = `${env}-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 17)}-${suffix++}`
  }
  try {
    execFileSync('git', ['tag', '-a', tagName, '-m', message || 'Rollback tag'])
    if (push) {
      const remote = process.env.GIT_PUSH_REMOTE || 'origin'
      execFileSync('git', ['push', remote, tagName])
    }
    console.log(`Created tag: ${tagName}`)
    process.exit(0)
  } catch (e) {
    console.error('Failed to create tag:', e.message)
    process.exit(1)
  }
}

usage()
