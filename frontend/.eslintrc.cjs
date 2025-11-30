module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  plugins: [
    'react-refresh',
    '@typescript-eslint'
  ],
  rules: {
    // ESLint rules configuration
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',
    'react-refresh/only-export-components': 'off',
    'no-useless-escape': 'off',
    'prefer-const': 'off',
    'no-var': 'off',
    '@typescript-eslint/ban-types': 'off'
  },
  ignorePatterns: [
    '.next/**',
    'out/**',
    'build/**',
    'node_modules/**',
    'dist/**',
    'next-env.d.ts'
  ]
};