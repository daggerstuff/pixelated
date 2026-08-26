const { Command } = require('commander')
const program = new Command()
// Register advisor as action-based subcommand
program
  .command('advisor', 'advisor agent')
  .command('review', 'run review')
  .option('--compact', 'compact output')
  .action((opts) => {
    console.log('OPTS:', JSON.stringify(opts))
  })
program.parse(['px', 'advisor', 'review', '--compact'])
