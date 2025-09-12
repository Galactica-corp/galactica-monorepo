import { globalIgnores } from 'eslint/config';

import baseConfig from '../../eslint.config.mjs';

const config = [
  ...baseConfig,

  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-globals': 0, // allow node code to use the process global
    },
  },

  globalIgnores(['dist/']),
];

export default config;
