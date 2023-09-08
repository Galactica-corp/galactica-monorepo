module.exports = {
  extends: ['../../.eslintrc.js'],

  overrides: [
    {
      files: ['hardhat.config.ts'],
      rules: {
        'import/no-unassigned-import': 0, // accepting hardhat standard
        'no-restricted-globals': 0, // using global to get environment variables
      },
    },
    {
      files: ['lib/helpers.ts'],
      rules: {
        'no-bitwise': 0, // best option for hashing string to field number
      },
    },
  ],

  ignorePatterns: ['!.eslintrc.js', 'build/', 'gatsby*'],
};
