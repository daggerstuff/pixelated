#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js'

const passthroughArgs = process.argv.slice(2)
const separatorIndex = passthroughArgs.indexOf('--')
const childArgs = separatorIndex >= 0 ? passthroughArgs.slice(separatorIndex + 1) : passthroughArgs

if (childArgs.length === 0) {
  process.stderr.write(
    'Usage: node scripts/utils/mcp-resource-compat-proxy.mjs -- <command> [args...]\n',
  )
  process.exit(1)
}

const [childCommand, ...childCommandArgs] = childArgs
const child = spawn(childCommand, childCommandArgs, {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: process.env,
})

child.stdin.on('error', () => {
  // Ignore broken-pipe errors after the downstream MCP server exits.
})

function createMessageReader(onMessage) {
  const readBuffer = new ReadBuffer()
  return (chunk) => {
    readBuffer.append(chunk)
    while (true) {
      const message = readBuffer.readMessage()
      if (message === null) {
        return
      }
      onMessage(message)
    }
  }
}

function writeToParent(message) {
  process.stdout.write(serializeMessage(message))
}

function writeToChild(message) {
  child.stdin.write(serializeMessage(message))
}

const proxyHandledMethods = new Map([
  [
    'resources/list',
    () => ({
      resources: [],
    }),
  ],
  [
    'resources/templates/list',
    () => ({
      resourceTemplates: [],
    }),
  ],
])

const parentParser = createMessageReader((message) => {
  if (message && typeof message === 'object' && 'id' in message && proxyHandledMethods.has(message.method)) {
    const resultFactory = proxyHandledMethods.get(message.method)
    writeToParent({
      jsonrpc: '2.0',
      id: message.id,
      result: resultFactory(),
    })
    return
  }

  writeToChild(message)
})

const childParser = createMessageReader((message) => {
  writeToParent(message)
})

process.stdin.on('data', parentParser)
child.stdout.on('data', childParser)

process.stdin.on('end', () => {
  child.stdin.end()
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1)
    return
  }

  process.exit(code ?? 1)
})

child.on('error', (error) => {
  process.stderr.write(`${String(error)}\n`)
  process.exit(1)
})
