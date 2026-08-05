import type { Command } from 'commander'
import pc from 'picocolors'
import { loadConfig } from '../lib/config-loader.js'
import type { LoadedConfig } from '../lib/config-loader.js'

export function registerConfig(program: Command): void {
  program
    .command('config')
    .description('Show the resolved px config (merged from all sources)')
    .option('--sources', 'Include config source paths in output')
    .action((options: { sources?: boolean }) => {
      const loaded = loadConfig()

      if (!options.sources) {
        console.log(JSON.stringify(loaded.config, null, 2))
        return
      }

      console.log(
        JSON.stringify(
          {
            config: loaded.config,
            sources: loaded.sources,
          },
          null,
          2,
        ),
      )
    })
}

export type { LoadedConfig }
