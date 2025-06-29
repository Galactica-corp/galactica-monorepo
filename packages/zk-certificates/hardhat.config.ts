// import '@nomicfoundation/hardhat-ignition-ethers';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-chai-matchers';
import '@nomicfoundation/hardhat-ethers';
import '@typechain/hardhat';
import 'hardhat-circom';
import { Wallet } from 'ethers';
import type { HardhatUserConfig } from 'hardhat/config';

import './tasks/createZkCertificate';
import './tasks/smartCircuitBuild';
import './tasks/revokeZkCertificate';
import './tasks/reissueZkCertificate';
import './tasks/circomTemplate';
import './tasks/hashStringToField';
import './tasks/reliefZkCertQueue';

const config: HardhatUserConfig = {
  mocha: {
    timeout: 100000000,
  },
  solidity: {
    compilers: [
      {
        version: '0.6.11', // for Verifier created by hardhat-circom
      },
      {
        version: '0.8.17',
      },
      {
        version: '0.8.12',
      },
      {
        version: '0.8.20',
      },
      {
        version: '0.8.28',
      },
    ],
  },
  networks: {
    galaAndromeda: {
      url: 'https://evm-rpc-http-andromeda.galactica.com/',
      accounts: getAccounts(),
    },
    reticulum: {
      url: 'https://evm-rpc-http-reticulum.galactica.com/',
      accounts: getAccounts(),
    },
    cassiopeia: {
      url: 'https://galactica-cassiopeia.g.alchemy.com/public',
      accounts: getAccounts(),
    },
    binanceTestnet: {
      url: process.env.BSCTestnetRPCURL ?? 'default',
      accounts: getAccounts(),
    },
    mainnet: {
      url: process.env.MainnetInfuraAPI ?? 'default',
      accounts: getAccounts(),
      /* gasPrice: 30000000000 */
    },
  },
  etherscan: {
    apiKey: {
      galaAndromeda: 'something', // not needed for now
      reticulum: 'something', // not needed for now
      cassiopeia: process.env.ALCHEMY_API_KEY ?? '',
      bscTestnet: process.env.BSCScanApiKey ?? '',
      mainnet: process.env.EtherscanApiKey ?? '',
    },
    customChains: [
      {
        network: 'galaAndromeda',
        chainId: 41238,
        urls: {
          apiURL: 'https://explorer-andromeda.galactica.com/api',
          browserURL: 'https://explorer-andromeda.galactica.com/',
        },
      },
      {
        network: 'reticulum',
        chainId: 9302,
        urls: {
          apiURL: 'https://explorer-reticulum.galactica.com/api',
          browserURL: 'https://explorer-reticulum.galactica.com/',
        },
      },
      {
        network: 'cassiopeia',
        chainId: 843843,
        urls: {
          apiURL: 'https://galactica-cassiopeia.explorer.alchemy.com/api',
          browserURL: 'https://galactica-cassiopeia.explorer.alchemy.com/',
        },
      },
    ],
  },
  circom: {
    // Base path for input files
    inputBasePath: './circuits',
    // Base path for files being output, defaults to `./circuits/`
    outputBasePath: './circuits/build',
    // The final ptau file, relative to inputBasePath, from a Phase 1 ceremony
    ptau: 'pot17_final.ptau',
    // Each object in this array refers to a separate circuit

    circuits: [
      {
        name: 'zkKYC',
        circuit: 'test/test_zkKYC.circom',
        input: 'input/zkKYC.json',
      },
      {
        name: 'merkleProof',
        circuit: 'test/test_merkleProof.circom',
        input: 'input/merkleProof.json',
      },
      {
        name: 'merkleProof2',
        circuit: 'test/test_merkleProof_2.circom',
        input: 'input/merkleProof_2.json',
      },
      {
        name: 'calculateZkCertHash',
        circuit: 'test/test_calculateZkCertHash.circom',
        input: 'input/calculateZkCertHash.json',
      },
      {
        name: 'humanID',
        circuit: 'test/test_humanID.circom',
        input: 'input/humanID.json',
      },
      {
        name: 'ownership',
        circuit: 'test/test_ownership.circom',
        input: 'input/ownership.json',
      },
      {
        name: 'ageProof',
        circuit: 'test/test_ageProof.circom',
        input: 'input/ageProof.json',
      },
      // {
      //   name: 'ageProofZkKYC',
      //   circuit: 'test/test_ageProofZkKYC.circom',
      //   input: 'input/ageProofZkKYC.json',
      // },
      {
        name: 'authorization',
        circuit: 'test/test_authorization.circom',
        input: 'input/authorization.json',
      },
      {
        name: 'mimcEncrypt',
        circuit: 'test/test_mimcEncrypt.circom',
        input: 'input/mimcEncrypt.json',
      },
      {
        name: 'mimcEnDecrypt',
        circuit: 'test/test_mimcEnDecrypt.circom',
        input: 'input/mimcEnDecrypt.json',
      },
      {
        name: 'privToPubKey',
        circuit: 'test/test_privToPubKey.circom',
        input: 'input/privToPubKey.json',
      },
      {
        name: 'ecdh',
        circuit: 'test/test_ecdh.circom',
        input: 'input/ecdh.json',
      },
      {
        name: 'encryptionProof',
        circuit: 'test/test_encryptionProof.circom',
        input: 'input/encryptionProof.json',
      },
      {
        name: 'polynomial',
        circuit: 'test/test_polynomial.circom',
        input: 'input/polynomial.json',
      },
      {
        name: 'shamirsSecretSharing',
        circuit: 'test/test_shamirsSecretSharing.circom',
        input: 'input/shamirsSecretSharing.json',
      },
      {
        name: 'investigatableZkKYC',
        circuit: 'test/test_investigatableZkKYC.circom',
        input: 'input/investigatableZkKYC.json',
      },
      {
        name: 'exampleMockDApp',
        circuit: 'test/test_exampleMockDApp.circom',
        input: 'input/exampleMockDApp.json',
      },
      {
        name: 'twitterZkCertificate',
        circuit: 'test/test_twitterZkCertificate.circom',
        input: 'input/twitterZkCertificate.json',
      },
      {
        name: 'twitterFollowersCountProof',
        circuit: 'test/test_twitterFollowersCountProof.circom',
        input: 'input/twitterFollowersCountProof.json',
      },
      {
        name: 'twitterVerificationProof',
        circuit: 'test/test_twitterVerificationProof.circom',
        input: 'input/twitterZkCertificate.json',
      },
      {
        name: 'poseidonSponge',
        circuit: 'test/test_poseidonSponge.circom',
        input: 'input/poseidonSponge.json',
      },
      // disabled because they take a long time to compile and are just for testing
      // {
      //   name: 'reputationExperiment',
      //   circuit: 'experiments/crossAccountReputation.circom',
      //   input: 'input/experiments/crossAccountReputation.json',
      // },
      {
        name: 'twitterCreationTimeProof',
        circuit: 'test/test_twitterCreationTimeProof.circom',
        input: 'input/twitterCreationTimeProof.json',
      },
      {
        name: 'exclusion3',
        circuit: 'test/test_exclusion3.circom',
        input: 'input/exclusion3.json',
      },
      {
        name: 'ageCitizenshipKYC',
        circuit: 'test/test_ageCitizenshipKYC.circom',
        input: 'input/ageCitizenshipKYC.json',
      },
    ],
  },
  ignition: {
    // setting required confirmations to 1 because cassiopeia only creates new blocks when there is a transaction
    requiredConfirmations: 1,
  },
};

/**
 * Gets the accounts for operation from the environment variables.
 * If they are not present, it will use random private keys (for example on the GitHub pipeline).
 * @returns Array of private keys.
 */
function getAccounts(): string[] {
  const accounts: string[] = [];
  // check if environment variables exist
  const warningMsg = ' env var not set, using random private key';

  if (process.env.GalaTestnetDeployerPrivateKey) {
    accounts.push(process.env.GalaTestnetDeployerPrivateKey);
  } else {
    console.warn(`GalaTestnetDeployerPrivateKey${warningMsg}`);
    accounts.push(Wallet.createRandom().privateKey);
  }
  if (process.env.GalaTestnetInstitution1PrivateKey) {
    accounts.push(process.env.GalaTestnetInstitution1PrivateKey);
  } else {
    console.warn(`GalaTestnetInstitution1PrivateKey${warningMsg}`);
    accounts.push(Wallet.createRandom().privateKey);
  }
  if (process.env.GalaTestnetInstitution2PrivateKey) {
    accounts.push(process.env.GalaTestnetInstitution2PrivateKey);
  } else {
    console.warn(`GalaTestnetInstitution2PrivateKey${warningMsg}`);
    accounts.push(Wallet.createRandom().privateKey);
  }
  if (process.env.GalaTestnetInstitution3PrivateKey) {
    accounts.push(process.env.GalaTestnetInstitution3PrivateKey);
  } else {
    console.warn(`GalaTestnetInstitution3PrivateKey${warningMsg}`);
    accounts.push(Wallet.createRandom().privateKey);
  }
  if (process.env.ReticulumGuardianPrivateKey) {
    accounts.push(process.env.ReticulumGuardianPrivateKey);
  } else {
    console.warn(`ReticulumGuardian${warningMsg}`);
    accounts.push(Wallet.createRandom().privateKey);
  }
  return accounts;
}

export default config;
