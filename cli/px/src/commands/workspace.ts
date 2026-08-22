import { Command } from 'commander'

import { loadConfig } from '../config/loader.js'

/**
 * Workspace surface commands — direct REST against /api/workspace/*.
 *
 * Unlike the agent surface (conversational Eve sessions), these are
 * deterministic object-level commands:
 *
 *   px workspace drive     list | get <id> | create title=.. [content=..]
 *   px workspace calendar  list | get <id> | create title=.. startAt=.. endAt=..
 *   px workspace contacts  list | get <id> | create name=.. [email=..]
 *   px workspace gmail     list [--unread] | get <id> | mark <id> read|unread
 *
 * All authorization scoping is enforced server-side (owner_id in SQL);
 * the CLI only needs a valid token from workspace.token in px config or
 * PX_WORKSPACE_TOKEN.
 */

type Surface = 'drive' | 'calendar' | 'contacts' | 'gmail'

interface WorkspaceEndpoint {
  base: string
  token: string
  timeoutMs: number
}

interface CommonOpts {
  endpoint?: string
  token?: string
  json?: boolean
  limit?: string
  unread?: boolean
}

function resolveWorkspace(opts: CommonOpts): WorkspaceEndpoint {
  const envToken = process.env['PX_WORKSPACE_TOKEN']
  const envEndpoint = process.env['PX_WORKSPACE_ENDPOINT']
  let configured: {
    endpoint?: string
    token?: string
    timeout?: number
  } = {}
  try {
    const { config } = loadConfig()
    configured = config.workspace ?? {}
  } catch {
    configured = {}
  }
  const base = (opts.endpoint ?? envEndpoint ?? configured.endpoint)?.replace(
    /\/$/,
    '',
  )
  if (!base) {
    throw new Error(
      'px: no workspace endpoint configured. Set workspace.endpoint in px config, or pass --endpoint / PX_WORKSPACE_ENDPOINT.',
    )
  }
  const token = opts.token ?? envToken ?? configured.token
  if (!token) {
    throw new Error(
      'px: no workspace token configured. Set workspace.token in px config, or pass --token / PX_WORKSPACE_TOKEN.',
    )
  }
  return { base, token, timeoutMs: configured.timeout ?? 30000 }
}

async function workspaceFetch(
  ws: WorkspaceEndpoint,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; data: unknown }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ws.timeoutMs)
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'authorization': `Bearer ${ws.token}`,
    }
    if (init.headers) {
      const initHeaders = new Headers(init.headers)
      initHeaders.forEach((value, key) => {
        headers[key] = value
      })
    }
    const res = await fetch(`${ws.base}/api/workspace${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    })
    const data = await res.json().catch(() => ({ error: 'non-JSON response' }))
    return { status: res.status, data }
  } finally {
    clearTimeout(timer)
  }
}

function print(
  result: { status: number; data: unknown },
  asJson: boolean,
): void {
  const { data } = result
  const record =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {}

  if (asJson) {
    console.log(JSON.stringify(data, null, 2))
  } else if (result.status >= 400) {
    const errMsg = typeof record.error === 'string'
      ? record.error
      : `request failed (${result.status})`
    console.error(`px: ${errMsg}`)
  } else {
    const list =
      record.documents ?? record.events ?? record.contacts ?? record.messages
    if (Array.isArray(list)) {
      if (list.length === 0) {
        console.log('(none)')
        return
      }
      for (const item of list as Array<Record<string, unknown>>) {
        console.log(JSON.stringify(compactRow(item)))
      }
      return
    }
    const item =
      record.document ?? record.event ?? record.contact ?? record.message
    console.log(
      JSON.stringify(
        compactRow(
          item && typeof item === 'object'
            ? (item as Record<string, unknown>)
            : record,
        ),
      ),
    )
  }
  process.exitCode = result.status >= 400 ? 1 : 0
}

function compactRow(item: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const key of ['id', 'title', 'name', 'subject', 'fromAddress', 'read']) {
    if (item[key] !== undefined) row[key] = item[key]
  }
  return row
}

function parseAssignments(assignments: string[]): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const a of assignments) {
    const idx = a.indexOf('=')
    if (idx <= 0) {
      throw new Error(`px: expected field=value, got "${a}"`)
    }
    body[a.slice(0, idx)] = a.slice(idx + 1)
  }
  return body
}

function sanitizeId(id: string): string {
  if (id.includes('/') || id.includes('..') || id.includes('\\')) {
    throw new Error(`px: invalid id "${id}" — path traversal not allowed`)
  }
  return id
}

function addCommonOptions(cmd: Command): Command {
  return cmd
    .option('-e, --endpoint <url>', 'workspace endpoint override')
    .option('-t, --token <token>', 'workspace bearer token override')
    .option('--json', 'emit raw JSON')
}

function registerSurface(
  parent: Command,
  surface: Surface,
  description: string,
): void {
  const cmd = parent.command(surface).description(description)

  const listCmd = cmd
    .command('list')
    .option('--limit <n>', 'max items to list')
    .description('List items visible to you')
  if (surface === 'gmail') {
    listCmd.option('--unread', 'unread only')
  }
  addCommonOptions(listCmd).action(async (opts: CommonOpts) => {
    const ws = resolveWorkspace(opts)
    let path = `/${surface}`
    if (opts.limit) path += `?limit=${opts.limit}`
    if (surface === 'gmail' && opts.unread) {
      path += `${path.includes('?') ? '&' : '?'}unread=true`
    }
    print(await workspaceFetch(ws, path), opts.json === true)
  })

  addCommonOptions(
    cmd.command('get <id>').description('Fetch one item by id'),
  ).action(async (id: string, opts: CommonOpts) => {
    const ws = resolveWorkspace(opts)
    const safeId = sanitizeId(id)
    print(await workspaceFetch(ws, `/${surface}/${safeId}`), opts.json === true)
  })

  if (surface !== 'gmail') {
    addCommonOptions(
      cmd
        .command('create <field=value...>')
        .description('Create an item owned by you'),
    ).action(async (assignments: string[], opts: CommonOpts) => {
      const ws = resolveWorkspace(opts)
      const body = parseAssignments(assignments)
      print(
        await workspaceFetch(ws, `/${surface}`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
        opts.json === true,
      )
    })
  }

  if (surface === 'gmail') {
    addCommonOptions(
      cmd
        .command('mark <id> <read|unread>')
        .description('Mark one message read or unread'),
    ).action(async (id: string, state: string, opts: CommonOpts) => {
      if (state !== 'read' && state !== 'unread') {
        throw new Error('px: state must be read or unread')
      }
      const ws = resolveWorkspace(opts)
      print(
        await workspaceFetch(ws, `/gmail/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ read: state === 'read' }),
        }),
        opts.json === true,
      )
    })
  }
}

export function registerWorkspaceCommand(program: Command): void {
  const workspace = program
    .command('workspace')
    .description(
      'Object-level workspace surfaces (drive, calendar, contacts, gmail)',
    )
  registerSurface(workspace, 'drive', 'Workspace documents (drive)')
  registerSurface(workspace, 'calendar', 'Workspace calendar events')
  registerSurface(workspace, 'contacts', 'Workspace contacts')
  registerSurface(workspace, 'gmail', 'Workspace inbox (gmail)')
}
