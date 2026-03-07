module.exports = {
  root: true,
  env: {
    node: true,
    es2024: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off',
    'no-process-exit': 'off',
  },
}
