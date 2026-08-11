import type { Command } from 'commander'

import { registerConfig } from './config.js'
import { registerInvoke } from './invoke.js'
import { registerHealthCommand } from './health.js'
import { registerListCommand } from './list.js'
import { registerInitCommand } from './init.js'
import { registerHookCommand } from './hook.js'
import { registerHookInstallCommand } from './hook.js'
import { registerAgentCommands } from './agents.js'
import { registerServeCommand } from './serve.js'

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
}
