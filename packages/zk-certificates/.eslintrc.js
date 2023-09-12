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
    {
      files: ['lib/merkleTree.ts', 'lib/sparseMerkleTree.ts'],
      rules: {
        'no-bitwise': 0, // path is given in binary format
      },
    },
    {
      files: ['lib/mimcEncrypt.ts'],
      // ignore to not differ too much from the original code
      rules: {
        'no-param-reassign': 0,
        'id-length': 0,
        '@typescript-eslint/naming-convention': 0,
        camelcase: 0,
        eqeqeq: 0,
        '@typescript-eslint/restrict-template-expressions': 0,
        '@typescript-eslint/prefer-for-of': 0,
      },
    },
    {
      files: ['scripts/verifyProofTest.ts'],
      rules: {
        // accepting naming given by snarkjs
        '@typescript-eslint/naming-convention': 0,
        camelcase: 0,
      },
    },
    {
      files: ['tasks/*.ts'],
      rules: {
        'no-restricted-globals': 0, // hardhat script can use process
      },
    },
    {
      files: ['test/circuits/*.ts'],
      rules: {
        'jest/expect-expect': 0, // accept tests that only try to run through without causing exceptions
      },
    },
    {
      files: ['test/contracts/*.ts'],
      rules: {
        '@typescript-eslint/no-unnecessary-type-assertion': 0, // disabled because ts and eslint disagree if it is needed or not
        'jest/expect-expect': 0, // accept tests that only try to run through without causing exceptions
      },
    },
  ],

  ignorePatterns: [
    '!.eslintrc.js',
    'artifacts/',
    'cache/',
    'circuits/build/',
  ],
};
