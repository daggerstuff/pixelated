import type { Command } from 'commander'

import { registerAgentCommands } from './agents.js'
import { registerConfig } from './config.js'
import { registerHealthCommand } from './health.js'
import { registerHookCommand } from './hook.js'
import { registerHookInstallCommand } from './hook.js'
import { registerInitCommand } from './init.js'
import { registerInvoke } from './invoke.js'
import { registerListCommand } from './list.js'
import { registerServeCommand } from './serve.js'
import { registerWorkspaceCommand } from './workspace.js'

export function registerAll(program: Command): void {
  registerConfig(program)
  registerInvoke(program)
  registerHealthCommand(program)
  registerListCommand(program)
  registerInitCommand(program)
  registerHookCommand(program)
  registerHookInstallCommand(program)
  registerAgentCommands(program)
  registerServeCommand(program)
  registerWorkspaceCommand(program)
}
