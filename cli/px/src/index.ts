import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Command } from 'commander'
import pc from 'picocolors'
import { registerAll } from './commands/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(here, '../package.json'), 'utf8')) as {
  version: string
}

async function main(): Promise<void> {
  const program = new Command()
  program
    .name('px')
    .description('px CLI — invoke Eve agents and inspect merged config')
    .version(pkg.version, '-v, --version', 'output the version number')
    .helpOption('-h, --help', 'display help')

  registerAll(program)

  await program.parseAsync(process.argv)
}

main().catch((error) => {
  console.error(pc.red(error instanceof Error ? error.message : String(error)))
  process.exitCode = 1
})
