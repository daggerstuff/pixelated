import { Command } from 'commander'
import { describe, expect, it } from 'vitest'

import { registerWorkspaceCommand } from './workspace'

function commandNames(cmd: Command): string[] {
  return cmd.commands.map((c) => c.name())
}

describe('registerWorkspaceCommand', () => {
  it('registers workspace with all four surfaces', () => {
    const program = new Command()
    registerWorkspaceCommand(program)

    const workspace = program.commands.find((c) => c.name() === 'workspace')
    expect(workspace).toBeDefined()
    expect(commandNames(workspace!)).toEqual([
      'drive',
      'calendar',
      'contacts',
      'gmail',
    ])
  })

  it('gives drive/calendar/contacts list, get, and create', () => {
    const program = new Command()
    registerWorkspaceCommand(program)
    const workspace = program.commands.find((c) => c.name() === 'workspace')!

    for (const surface of ['drive', 'calendar', 'contacts']) {
      const cmd = workspace.commands.find((c) => c.name() === surface)!
      expect(cmd).toBeDefined()
      expect(commandNames(cmd)).toEqual(['list', 'get', 'create'])
    }
  })

  it('gives gmail list, get, and mark (no create)', () => {
    const program = new Command()
    registerWorkspaceCommand(program)
    const workspace = program.commands.find((c) => c.name() === 'workspace')!
    const gmail = workspace.commands.find((c) => c.name() === 'gmail')!

    expect(commandNames(gmail)).toEqual(['list', 'get', 'mark'])

    // --unread is gmail-list-only
    const list = gmail.commands.find((c) => c.name() === 'list')!
    const flags = list.options.map((o) => o.long)
    expect(flags).toContain('--unread')

    const drive = workspace.commands.find((c) => c.name() === 'drive')!
    const driveList = drive.commands.find((c) => c.name() === 'list')!
    const driveFlags = driveList.options.map((o) => o.long)
    expect(driveFlags).not.toContain('--unread')
  })

  it('exposes common endpoint/token/json options on each action command', () => {
    const program = new Command()
    registerWorkspaceCommand(program)
    const workspace = program.commands.find((c) => c.name() === 'workspace')!
    const drive = workspace.commands.find((c) => c.name() === 'drive')!
    const list = drive.commands.find((c) => c.name() === 'list')!

    const longs = list.options.map((o) => o.long)
    expect(longs).toContain('--endpoint')
    expect(longs).toContain('--token')
    expect(longs).toContain('--json')
    expect(longs).toContain('--limit')
  })
})
