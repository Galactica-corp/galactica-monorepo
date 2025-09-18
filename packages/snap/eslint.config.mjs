import { globalIgnores } from 'eslint/config';

import baseConfig from '../../eslint.config.mjs';

const config = [
  ...baseConfig,
  {
    files: ['snap.config.ts'],
    rules: {
      'no-restricted-globals': 0, // accepting '__dirname' because Metamask suggested it like this
    },
  },
  {
    files: ['src/scripts/*.ts'],
    rules: {
      'n/no-sync': 0, // scripts are allowed to use sync methods
    },
  },
  globalIgnores(['**/dist/']),
];
export default config;
