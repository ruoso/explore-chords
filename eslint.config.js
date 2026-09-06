import js from '@eslint/js';

/**
 * The `core/` directory must stay pure and synchronous (docs/DESIGN.md §3.2).
 * The reference implementation awaited a data lookup inside its innermost DFS
 * loop, which dominated its runtime. A lint rule holds the line where a
 * convention would not.
 */
const noAsyncInCore = [
  'error',
  {
    selector: 'FunctionDeclaration[async=true]',
    message: 'core/ must stay synchronous (DESIGN.md 3.2). No async functions.',
  },
  {
    selector: 'FunctionExpression[async=true]',
    message: 'core/ must stay synchronous (DESIGN.md 3.2). No async functions.',
  },
  {
    selector: 'ArrowFunctionExpression[async=true]',
    message: 'core/ must stay synchronous (DESIGN.md 3.2). No async functions.',
  },
  {
    selector: 'AwaitExpression',
    message: 'core/ must stay synchronous (DESIGN.md 3.2). No await.',
  },
  {
    selector: 'ForOfStatement[await=true]',
    message: 'core/ must stay synchronous (DESIGN.md 3.2). No for-await.',
  },
];

export default [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/core/**/*.js'],
    rules: { 'no-restricted-syntax': noAsyncInCore },
  },
];
