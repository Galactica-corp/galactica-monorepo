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
    files: ['tasks/*.ts'],
    rules: {
      'no-restricted-globals': 0, // hardhat script can use process
    },
  },

  {
    files: ['test/**/*.ts'],
    rules: {
      'jest/expect-expect': 0, // accept tests that only try to run through without causing exceptions
      'n/no-unpublished-import': 'off', // hardhat packages are published but rule has issues with yarn workspace setup
    },
  },

  {
    files: ['ignition/modules/**/*.m.ts'],
    rules: {
      'n/no-unpublished-import': 'off', // hardhat packages are published but rule has issues with yarn workspace setup
    },
  },

  {
    files: ['scripts/**/*.ts'],
    rules: {
      'n/no-unpublished-import': 'off', // hardhat packages are published but rule has issues with yarn workspace setup
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
