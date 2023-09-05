module.exports = {
  extends: ['../../.eslintrc.js'],

  overrides: [
    {
      files: ['src/utils/invoke-snap.ts'],
      rules: {
        'no-restricted-globals': 0, // using window is ok in the browser, not sure how to disable the rule only for window.
      },
    },
  ],

  ignorePatterns: ['!.eslintrc.js', 'build/', 'gatsby*'],
};
