import { globalIgnores } from 'eslint/config';

import baseConfig from '../../eslint.config.mjs';

const config = [
  ...baseConfig,

  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/parameter-properties': 0, // simple classes are allowed
      'jsdoc/require-jsdoc': 0,
      'no-restricted-globals': 0, // using window is ok in the browser, not sure how to disable the rule only for window.
      '@typescript-eslint/naming-convention': 0, // required for metamask params such as `wallet_snap`
      '@typescript-eslint/unbound-method': 0, // ignoring because I don't want to touch the codebase provided by the Metamask snap template
    },
  },

  {
    files: ['src/pages/index.tsx'],
    rules: {
      'import-x/no-named-as-default-member': 0, // accept named imports for more readable hierarchy
      'no-bitwise': 0, // allow bitwise operations for error code checking
    },
  },

  {
    // config does not need site level standards
    files: ['src/config/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': 0,
    },
  },

  {
    // explicit exceptions to handle https://github.com/metamask/providers/issues/200
    files: ['src/utils/metamask.ts'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 0,
    },
  },

  globalIgnores(['**/build/', '**/gatsby*']),
];

export default config;
