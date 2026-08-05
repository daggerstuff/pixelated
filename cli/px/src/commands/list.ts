import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { formatAgentList } from '../output/format.js';

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('Show all available agents and their tools')
    .action(() => {
      const { config } = loadConfig();
      console.log(formatAgentList(config));
    });
}
