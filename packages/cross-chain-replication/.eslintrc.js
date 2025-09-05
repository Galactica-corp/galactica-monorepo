module.exports = {
  extends: ['../../.eslintrc.js'],

  parserOptions: {
    sourceType: 'module',
    allowImportExportEverywhere: true,
  },

  rules: {
    '@typescript-eslint/no-parameter-properties': 'off',
  },

  overrides: [
    {
      files: ['hardhat.config.ts'],
      rules: {
        'import/no-unassigned-import': 0, // accepting hardhat standard
        'no-restricted-globals': 0, // using global to get environment variables
      },
    },
    {
      files: ['test/**/*.ts'],
      rules: {
        '@typescript-eslint/no-unnecessary-type-assertion': 0, // disabled because ts and eslint disagree if it is needed or not
        'jest/expect-expect': 0, // accept tests that only try to run through without causing exceptions
      },
    },
    {
      files: ['scripts/**/*.ts'],
      rules: {
        'no-restricted-globals': 0, // allow local scripts to use the process global for error handling
      },
    },
  ],

  ignorePatterns: ['.eslintrc.js', 'cache/', 'artifacts/', 'dist/', 'ignition/deployments/'],
};
