import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginReact from 'eslint-plugin-react'
import pluginReactHooks from 'eslint-plugin-react-hooks'
import pluginJsxA11y from 'eslint-plugin-jsx-a11y'
import pluginNode from 'eslint-plugin-node'
import pluginVitest from 'eslint-plugin-vitest'
import pluginVitestGlobals from 'eslint-plugin-vitest-globals'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import css from '@eslint/css'

export default tseslint.config(
  // Base JavaScript recommendations
  js.configs.recommended,
  
  // Global ignore patterns (matching OXC config)
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'storybook-static/**',
      'docs/**',
      'tmp/**',
      '.vscode/**',
      '.git/**',
      '.github/**',
      '.husky/**',
      '.next/**',
      '.swc/**',
      '.turbo/**',
      '.yarn/**',
      'out/**',
      'build/**',
      'scripts/**/*.js',
      'scripts/**/*.cjs',
      'tests/security/node_modules/**',
      '*.generated.*',
    ],
  },

  // TypeScript recommended configs
  ...tseslint.configs.recommended,

  // Base configuration for all JS/TS files
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2025,
      },
      ecmaVersion: 2025,
      sourceType: 'module',
    },
  },

  // TypeScript-specific rules
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Disable base no-unused-vars for TypeScript files
      'no-unused-vars': 'off',
      
      // TypeScript ESLint unused vars with OXC-like configuration
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      // TypeScript correctness rules (matching OXC)
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-extra-non-null-assertion': 'error',
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/no-namespace': 'error',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/no-this-alias': 'error',
      '@typescript-eslint/no-unnecessary-type-constraint': 'error',
      '@typescript-eslint/no-unsafe-declaration-merging': 'error',
      '@typescript-eslint/no-unsafe-function-type': 'error',
      '@typescript-eslint/no-wrapper-object-types': 'error',
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      '@typescript-eslint/triple-slash-reference': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  // JavaScript correctness rules (matching OXC)
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      // Correctness category rules
      'for-direction': 'error',
      'no-async-promise-executor': 'error',
      'no-case-declarations': 'error',
      'no-class-assign': 'error',
      'no-compare-neg-zero': 'error',
      'no-cond-assign': 'error',
      'no-const-assign': 'error',
      'no-constant-binary-expression': 'error',
      'no-constant-condition': 'error',
      'no-control-regex': 'error',
      'no-debugger': 'error',
      'no-delete-var': 'error',
      'no-dupe-class-members': 'error',
      'no-dupe-else-if': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-empty': 'error',
      'no-empty-character-class': 'error',
      'no-empty-pattern': 'error',
      'no-empty-static-block': 'error',
      'no-ex-assign': 'error',
      'no-extra-boolean-cast': 'error',
      'no-fallthrough': 'error',
      'no-func-assign': 'error',
      'no-global-assign': 'error',
      'no-import-assign': 'error',
      'no-invalid-regexp': 'error',
      'no-irregular-whitespace': 'error',
      'no-loss-of-precision': 'error',
      'no-new-native-nonconstructor': 'error',
      'no-nonoctal-decimal-escape': 'error',
      'no-obj-calls': 'error',
      'no-prototype-builtins': 'error',
      'no-redeclare': 'error',
      'no-regex-spaces': 'error',
      'no-self-assign': 'error',
      'no-setter-return': 'error',
      'no-shadow-restricted-names': 'error',
      'no-sparse-arrays': 'error',
      'no-this-before-super': 'error',
      'no-unexpected-multiline': 'error',
      'no-unsafe-finally': 'error',
      'no-unsafe-negation': 'error',
      'no-unsafe-optional-chaining': 'error',
      'no-unused-labels': 'error',
      'no-unused-private-class-members': 'error',
      'no-useless-catch': 'error',
      'no-useless-escape': 'error',
      'no-with': 'error',
      'require-yield': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-array-constructor': 'error',
      'no-unused-expressions': 'error',

      // Disabled complexity rules (matching OXC)
      'max-lines-per-function': 'off',
      'max-depth': 'off',
      'complexity': 'off',
      'max-params': 'off',
      'max-statements': 'off',
      'no-await-in-loop': 'off',
    },
  },

  // React configuration
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      react: pluginReact,
      'react-hooks': pluginReactHooks,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      ...pluginReact.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      
      // React rules (matching OXC)
      'react/jsx-key': 'warn',
      'react/jsx-no-comment-textnodes': 'warn',
      'react/jsx-no-duplicate-props': 'warn',
      'react/jsx-no-target-blank': 'warn',
      'react/jsx-no-undef': 'warn',
      'react/no-children-prop': 'warn',
      'react/no-danger-with-children': 'warn',
      'react/no-direct-mutation-state': 'warn',
      'react/no-find-dom-node': 'warn',
      'react/no-is-mounted': 'warn',
      'react/no-render-return-value': 'warn',
      'react/no-string-refs': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react/no-unknown-property': [
        'warn',
        {
          ignore: [
            'attach',
            'args',
            'rotation',
            'position',
            'scale',
            'frustumCulled',
            'material',
          ],
        },
      ],
      'react/no-array-index-key': 'warn',
      
      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // JSX-A11y configuration
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      'jsx-a11y': pluginJsxA11y,
    },
    rules: {
      ...pluginJsxA11y.configs.recommended.rules,
    },
  },

  // Node.js configuration
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: {
      node: pluginNode,
    },
    rules: {
      ...pluginNode.configs.recommended.rules,
    },
  },

  // Vitest configuration
  {
    files: ['**/*.{test,spec}.{js,jsx,ts,tsx}'],
    plugins: {
      vitest: pluginVitest,
      'vitest-globals': pluginVitestGlobals,
    },
    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },
    rules: {
      ...pluginVitest.configs.recommended.rules,
    },
  },

  // Test files override (matching OXC config)
  {
    files: ['**/*.{test,spec}.{js,jsx,ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'react-hooks/rules-of-hooks': 'off',
    },
  },

  // Bias detection files override (matching OXC config)
  {
    files: ['src/lib/ai/bias-detection/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'max-lines-per-function': 'off',
      'max-depth': 'off',
      'complexity': 'off',
      'max-params': 'off',
      'max-statements': 'off',
    },
  },

  // JSON files
  {
    files: ['**/*.json'],
    plugins: { json },
    language: 'json/json',
  },
  {
    files: ['**/*.jsonc'],
    plugins: { json },
    language: 'json/jsonc',
  },
  {
    files: ['**/*.json5'],
    plugins: { json },
    language: 'json/json5',
  },

  // Markdown files
  {
    files: ['**/*.md'],
    plugins: { markdown },
    language: 'markdown/commonmark',
    rules: {
      'no-missing-label-refs': 'off',
      'markdown/no-missing-label-refs': 'off',
    },
  },

  // CSS files
  {
    files: ['**/*.css'],
    plugins: { css },
    language: 'css/css',
  },
)