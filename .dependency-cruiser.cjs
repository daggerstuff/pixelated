/**
 * dependency-cruiser — module boundary & architecture enforcement.
 *
 * Arrows matter: each rule describes an import relationship that must NOT
 * exist. Run with `pnpm lint:boundaries` (or via the Quality CI workflow).
 *
 * Design intent
 * ------------
 * `apps/web/src` is layered. Lower layers must never import higher ones, and
 * production code must never import test helpers or build artifacts. These
 * rules encode that layering so an agent cannot silently create a cycle or
 * reach across a boundary just because the import resolves.
 *
 * Baselines
 * ---------
 * Rules whose current violation count is non-zero are marked `warn` and their
 * counts are pinned in scripts/ci/boundaries-baseline.json. The ratchet script
 * (scripts/ci/boundaries-audit.mjs) fails when the count grows, so existing
 * debt is visible and cannot increase without an explicit baseline bump.
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment:
        'Circular dependencies make modules impossible to reason about or tree-shake.',
      severity: 'warn',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-test-imports-from-production',
      comment:
        'Production source must not import test files, fixtures, or mocks. ' +
        'Test-only helpers belong in a test file or a `__mocks__` directory.',
      severity: 'error',
      from: { pathNot: ['(\\.test\\.|\\.spec\\.|__tests__|__mocks__|/test/)'] },
      to: { path: '(\\.test\\.|\\.spec\\.|__tests__|__mocks__|/test/)' },
    },
    {
      name: 'lib-must-not-import-pages',
      comment:
        'Library code is a lower layer than routing. `pages/**` and `routes/**` ' +
        'may import lib; lib importing them inverts the dependency direction.',
      severity: 'warn',
      from: { path: '^apps/web/src/lib' },
      to: { path: '^apps/web/src/(pages|routes)' },
    },
    {
      name: 'utils-must-not-import-components',
      comment:
        'Utils are a leaf layer. Reaching up into React components couples ' +
        'pure helpers to UI and breaks reuse.',
      severity: 'warn',
      from: { path: '^apps/web/src/utils' },
      to: { path: '^apps/web/src/components' },
    },
    {
      name: 'no-import-from-build-output',
      comment:
        'Never import from build output (dist/build/out). Import the source ' +
        'module instead so the dependency graph stays source-accurate.',
      severity: 'error',
      from: {},
      to: { path: '(^|/)(dist|build|out)/' },
    },
    {
      name: 'no-cross-app-source-imports',
      comment:
        'Workspace apps may only consume each other through published package ' +
        'boundaries, never by reaching directly into another app source tree. ' +
        'Direct source imports defeat package encapsulation and break consumers ' +
        'when the source moves.',
      severity: 'error',
      from: { path: '^apps/web/src' },
      to: { path: '^apps/(business-strategy-cms)/src' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: [
        'node_modules',
        '\\.test\\.',
        '\\.spec\\.',
        '__tests__',
        '__mocks__',
        '/dist/',
        'apps/web/public',
      ],
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.d.ts'],
    },
    reporterOptions: {
      dot: { collapsePattern: 'node_modules/[^/]+' },
      archi: { collapsePattern: '^(apps/web/src/[^/]+)/.*' },
    },
  },
}
