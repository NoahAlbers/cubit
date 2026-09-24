import js from '@eslint/js';
import ts from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default ts.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/**'] },
  {
    files: ['src/**/*.ts'],
    extends: [js.configs.recommended, ...ts.configs.recommended, prettier],
    languageOptions: { globals: { module: 'readonly', require: 'readonly', Buffer: 'readonly', process: 'readonly', console: 'readonly', setTimeout: 'readonly', setInterval: 'readonly', clearTimeout: 'readonly', clearInterval: 'readonly', __dirname: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', fetch: 'readonly', AbortController: 'readonly' } },
    rules: {
      // Legacy services remain incrementally typed; the request boundary below is strict.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    files: ['src/api/common/request-schema.ts', 'src/api/routes/{operations,staff-tools,waivers,backups}.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
);
