import { fileURLToPath } from 'node:url';
import type { LocalOxlintConfig } from './oxlint.types.ts';

export const sharedRules = {
  'perfectionist/sort-enums': 'off',
  'perfectionist/sort-heritage-clauses': 'off',
  'perfectionist/sort-interfaces': 'off',
  'perfectionist/sort-jsx-props': 'off',
  'perfectionist/sort-object-types': 'off',
  'perfectionist/sort-objects': 'off',
  'import-x/no-namespace': 'off',
  'unicorn/consistent-function-scoping': 'off',
  '@nkzw/no-instanceof': 'off',
  '@nkzw/ensure-relay-types': 'off',
  'react/immutability': 'off',
  'react/refs': 'off',
  'unicorn/prefer-string-slice': 'off',
  'unicorn/prefer-top-level-await': 'off',
  'unicorn/catch-error-name': 'off',
  'unicorn/numeric-separators-style': 'off',
  'unicorn/prefer-string-replace-all': 'off',
  'unicorn/prefer-at': 'off',
  // Hermes has no toSorted; ast-grep no-es2023-array-methods guards the app bundle.
  'unicorn/no-array-sort': 'off',
  'unicorn/prefer-single-call': 'off',
  'unicorn/prefer-array-index-of': 'off',
  'unicorn/prefer-node-protocol': 'off',
  'unicorn/prefer-string-raw': 'off',
  'unicorn/no-hex-escape': 'off',
  'prefer-arrow-callback': 'off',
  'object-shorthand': 'off',
  'no-empty': 'off',
  'unicorn/prefer-number-properties': 'off',
  'typescript/array-type': ['error', { default: 'array' }],
} satisfies NonNullable<LocalOxlintConfig['rules']>;

export const stylePlugin = {
  name: 'style',
  specifier: fileURLToPath(
    new URL('./tools/oxlint/style/index.ts', import.meta.url),
  ),
};
