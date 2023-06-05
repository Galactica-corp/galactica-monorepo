module.exports = {
  extends: ['../../.eslintrc.js'],

  overrides: [
    {
      files: ['**/*.{ts,tsx}'],
      rules: {
        'jsdoc/require-jsdoc': 0,
        'no-restricted-globals': 0, // using window is ok in the browser, not sure how to disable the rule only for window.
        '@typescript-eslint/naming-convention': 0, // required for metamask params such as `wallet_snap`
        '@typescript-eslint/no-parameter-properties': 0, // This is can be much more readable like this.
      },
    },
    {
      // config does not need site level standards
      files: ['src/config/*.{ts,tsx}'],
      rules: {
        'no-restricted-globals': 0,
      },
    },
    {
      // explicit exceptions to handle https://github.com/metamask/providers/issues/200
      files: ['src/utils/metamask.ts'],
      rules: {
        '@typescript-eslint/ban-ts-comment': 0,
      },
    },
  ],

  ignorePatterns: ['!.eslintrc.js', 'build/', 'gatsby*'],
};
