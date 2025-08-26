import { globalIgnores } from 'eslint/config';

import baseConfig from '../../eslint.config.mjs';

const config = [
  ...baseConfig,

  {
    files: [
      '**/src/utils/invoke-snap.ts',
      '**/src/api/snap.ts',
      '**/src/types/index.d.ts',
    ],
    rules: {
      'no-restricted-globals': 'off', // using window is ok in the browser, not sure how to disable the rule only for window.
    },
  },

  globalIgnores(['!**/.eslintrc.js', '**/build/', '**/gatsby*']),
];

export default config;
