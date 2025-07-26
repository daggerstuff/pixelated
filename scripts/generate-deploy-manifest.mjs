import fs from 'fs'
import path from 'path'

const projectRoot = process.cwd()
const packageJsonPath = path.join(projectRoot, 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

// Get the Astro version from dependencies or devDependencies
let astroVersion =
  packageJson.dependencies?.astro || packageJson.devDependencies?.astro

// Clean the version string to remove characters like '^' or '~'
if (astroVersion) {
  astroVersion = astroVersion.replace(/[^\d.]/g, '')
}

if (!astroVersion) {
  console.error('Error: Astro version not found in package.json.')
  process.exit(1)
}

const manifest = {
  version: 1,
  routes: [
    {
      path: '/_astro/*',
      target: { kind: 'static' },
    },
    {
      path: '/*',
      target: { kind: 'compute', src: 'default' },
    },
  ],
  computeResources: [
    {
      name: 'default',
      runtime: 'nodejs22.x',
      entrypoint: 'server/entry.mjs',
    },
  ],
  framework: {
    name: 'astro',
    version: astroVersion,
  },
}

const outputDir = path.join(projectRoot, '.amplify-hosting')
const outputPath = path.join(outputDir, 'deploy-manifest.json')

fs.mkdirSync(outputDir, { recursive: true })
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2))

console.log(`✅ Successfully created deploy-manifest.json at ${outputPath}`)
