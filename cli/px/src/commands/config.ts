import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { formatConfig } from '../output/format.js';

export function registerConfigCommand(program: Command): void {
  program
    .command('config')
    .description('Show resolved configuration (merged from all sources)')
    .action(() => {
      const loaded = loadConfig();
      console.log(formatConfig(loaded));
    });
}
