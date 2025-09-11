import { globalIgnores } from 'eslint/config';

import baseConfig from '../../eslint.config.mjs';

const config = [
  ...baseConfig,

  {
    files: ['hardhat.config.ts'],
    rules: {
      'import-x/no-unassigned-import': 0, // accepting hardhat standard
      'no-restricted-globals': 0, // using global to get environment variables
    },
  },

  {
    files: ['scripts/*/*.ts'],
    rules: {
      'no-restricted-globals': 0, // allow local scripts to use the process global for error handling
    },
  },

  {
    files: ['tasks/*.ts'],
    rules: {
      'no-restricted-globals': 0, // hardhat script can use process
    },
  },

  {
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': 0, // node tests still work
      'import-x/extensions': 0, // did not found a better option for imports
      'n/no-unpublished-import': 0, // allow importing dev dependencies in tests
    },
  },

  {
    files: ['ignition/**/*.ts'],
    rules: {
      'import-x/extensions': 0, // did not found a better option for imports
      'n/no-unpublished-import': 0, // allow importing dev dependencies in tests
    },
  },

  globalIgnores([
    '.eslintrc.js',
    'cache/',
    'contracts/.prettierrc.js',
    '/flat/',
    '/ignition/deployments/',
  ]),
];

export default config;
