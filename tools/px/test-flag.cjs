const { Command } = require('commander')
const program = new Command()
program.allowUnknownOption()
const advisor = program.command('advisor').description('advisor agent')
const review = advisor
  .command('review')
  .description('run review')
  .option('--dry-run', 'dry run')
  .option('--compact', 'compact output')
  .action((opts) => {
    console.log('OPTS:', JSON.stringify(opts))
  })
program.parse(['px', 'advisor', 'review', '--dry-run', '--compact'])
