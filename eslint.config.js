// Code style for lumio-device-interfaces (same rules as every Lumio repository). Stylistic rules mirror the project owner's existing ESLint conventions;
// typescript-eslint adds type-aware checks (floating promises, unsafe any) on top.
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import promise from 'eslint-plugin-promise';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/', '**/__snapshots__/'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
    },
    plugins: { '@stylistic': stylistic, promise },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }],
      '@typescript-eslint/no-non-null-assertion': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      curly: 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],

      '@stylistic/indent': ['error', 2],
      '@stylistic/key-spacing': ['error', { beforeColon: false, afterColon: true, mode: 'strict' }],
      '@stylistic/keyword-spacing': ['error', { before: true, after: true }],
      '@stylistic/linebreak-style': ['error', 'unix'],
      '@stylistic/space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
      '@stylistic/space-infix-ops': 'error',
      '@stylistic/space-before-blocks': ['error', 'always'],
      '@stylistic/comma-dangle': ['error', 'never'],
      '@stylistic/max-len': ['error', { code: 160, ignoreUrls: true, ignoreRegExpLiterals: true }],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1 }],
      '@stylistic/eol-last': ['error', 'always'],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/no-extra-semi': 'error',
      '@stylistic/no-multi-spaces': 'error',
      '@stylistic/no-mixed-spaces-and-tabs': 'error',
      '@stylistic/arrow-parens': ['error', 'always'],
      '@stylistic/arrow-spacing': ['error', { before: true, after: true }],
      '@stylistic/block-spacing': 'error',
      '@stylistic/brace-style': ['error', 'stroustrup'],
      '@stylistic/comma-spacing': ['error', { before: false, after: true }],
      '@stylistic/comma-style': ['error', 'last'],
      '@stylistic/dot-location': ['error', 'property'],
      '@stylistic/function-call-spacing': ['error', 'never'],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/member-delimiter-style': 'error',
      '@stylistic/type-annotation-spacing': 'error',

      'promise/always-return': ['error', { ignoreLastCallback: true }],
      'promise/catch-or-return': ['error', { allowFinally: true }],
      'promise/no-new-statics': 'error',
      'promise/no-return-in-finally': 'warn',
      'promise/valid-params': 'warn'
    }
  },
  {
    files: ['scripts/**/*.ts', 'test/**/*.ts'],
    rules: { 'no-console': 'off' }
  },
  {
    files: ['eslint.config.js'],
    ...tseslint.configs.disableTypeChecked
  }
);
