import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {ignores: ['dist/', 'coverage/', 'public/app.js']},
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {globals: {...globals.node}},
    rules: {
      curly: ['error', 'all'],
      'no-nested-ternary': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {ignoreRestSiblings: true}],
    },
  },
  {
    files: ['web/**/*.ts', 'public/**/*.js'],
    languageOptions: {globals: {...globals.browser}},
  },
);
