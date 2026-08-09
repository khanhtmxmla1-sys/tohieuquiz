import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

const sourceFiles = [
  'App.tsx',
  'index.tsx',
  'src/**/*.{ts,tsx}',
  'stores/**/*.{ts,tsx}',
  'utils/**/*.{ts,tsx}',
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.worktrees/**',
      '**/.agent/**',
      '**/.agents/**',
      '**/.claude/**',
      '**/.gitnexus/**',
      '**/.wrangler/**',
      '**/.vercel/**',
      '**/artifacts/**',
      '**/downloads/**',
      '**/cypress/screenshots/**',
      '**/cypress/videos/**',
      '**/public/**',
      '**/assets/**',
      '**/*.min.js',
      '**/*.d.ts',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.worker,
        ...globals.es2024,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,mjs,cjs}'],
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/ban-ts-comment': ['error', {
        'ts-ignore': 'allow-with-description',
        minimumDescriptionLength: 10,
      }],
    },
  },
  {
    files: sourceFiles,
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      // Existing effects are migrated in a dedicated strict lane so enabling lint does not
      // silently change fetch, autosave, game-loop, or navigation behavior in one batch.
      'react-hooks/exhaustive-deps': 'off',
      'no-debugger': 'error',
      'no-constant-binary-expression': 'error',
      'no-promise-executor-return': 'error',
      'no-unreachable-loop': 'error',
      'no-unsafe-optional-chaining': 'error',
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}', 'cypress/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-namespace': 'off',
    },
  },
  {
    files: ['workers/src/**/*.{ts,tsx}'],
    rules: {
      'no-debugger': 'error',
      'no-constant-binary-expression': 'error',
      'no-promise-executor-return': 'error',
      'no-unreachable-loop': 'error',
      'no-unsafe-optional-chaining': 'error',
    },
  },
);
