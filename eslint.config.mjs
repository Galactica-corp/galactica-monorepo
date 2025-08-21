import base, { createConfig } from '@metamask/eslint-config';
import browser from '@metamask/eslint-config-browser';
import nodejs from '@metamask/eslint-config-nodejs';
import typescript from '@metamask/eslint-config-typescript';
import chaiFriendly from 'eslint-plugin-chai-friendly';

const config = createConfig([
  {
    ignores: [
      '**/build/',
      '**/.cache/',
      '**/dist/',
      '**/docs/',
      '**/public/',
      '.yarn/',
      '**/typechain-types/**',
      '**/node_modules/**',
      '**/*.d.ts',
      '**/circuits/build/**',
      '**/contracts/.prettierrc.js',
      '**/ignition/deployments/**',
      '**/issuedZKCertificates/**',
      '**/merkleProofs/**',
    ],
  },

  {
    extends: base,

    languageOptions: {
      sourceType: 'module',
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: ['./tsconfig.json'],
      },
    },

    settings: {
      'import-x/extensions': ['.js', '.mjs'],
    },
  },

  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: typescript,

    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-shadow': ['error', { allow: ['Text'] }],
      'import-x/no-nodejs-modules': 'off', // Importing buffer for base64 decoding
      '@typescript-eslint/no-unsafe-enum-comparison': 'off', // allow enum comparison with string, such as zkCertStandard === KnownZkCertStandard.ZkKYC
    },
  },

  {
    files: [
      '**/*.js',
      '**/*.cjs',
      'packages/snap/snap.config.ts',
      '**/scripts/*.ts',
    ],
    extends: nodejs,

    languageOptions: {
      sourceType: 'script',
    },
    rules: {
      'import/no-nodejs-modules': 'off',
      'no-restricted-globals': 'off',
      'no-bitwise': 'off',
    },
  },

  {
    files: [
      '**/*.t.ts',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.test.js',
      '**/test/**/*.ts',
    ],
    extends: [nodejs],
    plugins: {
      'chai-friendly': chaiFriendly,
    },
    rules: {
      'no-unused-expressions': 'off', // Disable core rule if enabled
      '@typescript-eslint/no-unused-expressions': 'off', // Disable typed rule
      'chai-friendly/no-unused-expressions': 'error', // Enable friendly version

      '@typescript-eslint/unbound-method': 'off',

      'n/no-sync': 'off', // enable read file sync in tests
    },
  },

  {
    files: ['**/eslint.config.mjs'],

    rules: {
      'import-x/extensions': 'off', // accept mjs extension
    },
  },

  {
    files: ['packages/site/src/**'],
    extends: [browser],
  },
]);

export default config;
