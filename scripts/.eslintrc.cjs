module.exports = {
  root: false,
  env: {
    node: true,
    es2024: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off',
    'no-process-exit': 'off',
  },
}
