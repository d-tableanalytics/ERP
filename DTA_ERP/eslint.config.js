import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^[A-Z_]',
        args: 'none',
        caughtErrors: 'none',
      }],
      // Resetting local state when a modal opens / props change is an intentional
      // pattern throughout this codebase; the rule is overly aggressive here.
      'react-hooks/set-state-in-effect': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Test files run under Jest/Vitest-style globals.
    files: ['**/*.test.{js,jsx}', 'src/tests/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.jest, ...globals.node },
    },
  },
])
