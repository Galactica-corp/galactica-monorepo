module.exports = {
  root: true,
  extends: ['@metamask/eslint-config'],

  parserOptions: {
    sourceType: 'module',
    allowImportExportEverywhere: true,
  },

  rules: {
    '@typescript-eslint/no-parameter-properties': 'off',
  },

  overrides: [
    {
      files: ['**/*.js'],
      extends: ['@metamask/eslint-config-nodejs'],
    },

    {
      files: ['**/*.{ts,tsx}'],
      extends: ['@metamask/eslint-config-typescript'],
      rules: {
        '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
        // Importing buffer for base64 decoding
        'import/no-nodejs-modules': 'off',
      },
    },

    {
      files: ['**/*.test.ts', '**/*.test.js', '**/test/**/**.ts'],
      extends: ['@metamask/eslint-config-jest'],
      rules: {
        '@typescript-eslint/no-shadow': [
          'error',
          { allow: ['describe', 'expect', 'it'] },
        ],
        '@typescript-eslint/no-unused-expressions': 'off', // allow expect() expressions without assignment
      },
    },
    {
      // disabled according to https://github.com/import-js/eslint-plugin-import/issues/2215
      files: ['**/*.d.ts'],
      rules: {
        'import/unambiguous': 'off',
      },
    },
    {
      // less strict rules for developer scripts
      files: ['**/scripts/*.ts'],
      rules: {
        'import/no-nodejs-modules': 'off',
        'no-restricted-globals': 'off',
        'no-bitwise': 'off',
      },
    },
  ],

  ignorePatterns: [
    '!.prettierrc.js',
    '**/!.eslintrc.js',
    '**/dist*/',
    '**/*__GENERATED__*',
    '**/build',
    '**/public',
    '**/.cache',
  ],

  settings: {
    jest: {
      version: 26,
    },
  },
};
