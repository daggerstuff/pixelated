import type { Command } from 'commander'

import { registerConfig } from './config.js'
import { registerInvoke } from './invoke.js'

export function registerAll(program: Command): void {
  registerConfig(program)
  registerInvoke(program)
}
