module.exports = {
  extends: ['../../.eslintrc.js'],

  rules: {
    '@typescript-eslint/no-parameter-properties': 'off',
  },

  ignorePatterns: ['!.eslintrc.js', 'dist/'],
};
