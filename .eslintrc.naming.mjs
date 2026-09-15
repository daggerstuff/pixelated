/**
 * Naming-convention check (TypeScript/TSX only).
 *
 * Kept separate from `eslint.config.js` because the shared flat config also
 * registers language plugins for JSON/CSS/Markdown, and linting a directory
 * that contains those files crashes on incompatibility. This config scopes the
 * run to TS/TSX (`pnpm lint:naming` passes explicit globs) so the naming rule
 * can be enforced and ratcheted independently of the rest of ESLint.
 *
 * The rule encodes the documented style: camelCase for values, functions, and
 * parameters; PascalCase for types and classes; UPPER_CASE or PascalCase for
 * enum members and module-level constants. Properties are exempted because
 * object keys often mirror external payloads (JSON bodies, DB rows) that we do
 * not control. See AGENTS.md §3 for the documented source of truth.
 */

import tseslint from 'typescript-eslint'

export default tseslint.config({
  files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
  ignores: [
    '**/node_modules/**',
    '**/dist/**',
    '**/*.d.ts',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
    '**/__tests__/**',
    '**/__mocks__/**',
    '**/*.generated.*',
    '**/generated/**',
  ],
  plugins: { '@typescript-eslint': tseslint.plugin },
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaVersion: 2025, sourceType: 'module' },
  },
  rules: {
    '@typescript-eslint/naming-convention': [
      'error',
      // Node's `__dirname` / `__filename` globals and double-underscore
      // framework flags are not ours to rename.
      {
        selector: 'variable',
        filter: { regex: '^__', match: true },
        format: null,
      },
      {
        selector: 'default',
        format: ['camelCase', 'PascalCase'],
        leadingUnderscore: 'allow',
        trailingUnderscore: 'allow',
      },
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        leadingUnderscore: 'allow',
      },
      {
        selector: 'parameter',
        format: ['camelCase', 'PascalCase'],
        leadingUnderscore: 'allow',
      },
      {
        selector: 'function',
        format: ['camelCase', 'PascalCase'],
        leadingUnderscore: 'allow',
      },
      { selector: 'class', format: ['PascalCase'] },
      // Internal-only type aliases are conventionally prefixed with `_`.
      {
        selector: 'typeLike',
        format: ['PascalCase'],
        leadingUnderscore: 'allow',
      },
      { selector: 'enumMember', format: ['UPPER_CASE', 'PascalCase'] },
      // Getters/setters commonly expose UPPER_CASE constants.
      {
        selector: 'classicAccessor',
        format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
      },
      // External/DB-shaped keys, event-handler literals, and framework hooks
      // (e.g. `"message.completed"`, `onClick`) are not ours to rename.
      { selector: 'property', format: null },
      { selector: 'typeProperty', format: null },
      { selector: 'objectLiteralProperty', format: null },
      { selector: 'objectLiteralMethod', format: null },
      { selector: 'classProperty', format: null },
      { selector: 'import', format: null },
    ],
  },
})
