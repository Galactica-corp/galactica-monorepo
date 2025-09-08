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

  globalIgnores([
    '.eslintrc.js',
    'cache/',
    'contracts/.prettierrc.js',
    '/flat/',
    '/ignition/deployments/',
  ]),
];

export default config;
