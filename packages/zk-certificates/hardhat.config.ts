import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-chai-matchers';
import '@nomiclabs/hardhat-ethers';
import '@typechain/hardhat';
import 'hardhat-circom';
import { Wallet } from 'ethers';
import { HardhatUserConfig } from 'hardhat/config';

import './tasks/createZKKYC';
import './tasks/smartCircuitBuild';
import './tasks/revokeZKKYC';
import './tasks/reissueZKKYC';

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
    ],
  },
  networks: {
    galaTestnet: {
      url: 'https://evm-rpc-http-devnet-41233.galactica.com/', // requires gala dev wireguard connection
      accounts: getAccounts(),
    },
  },
  etherscan: {
    apiKey: {
      galaTestnet: 'something', // not needed for now, I guess
    },
    customChains: [
      {
        network: 'galaTestnet',
        chainId: 41233,
        urls: {
          apiURL: 'https://explorer-devnet-41233.galactica.com/api',
          browserURL: 'https://explorer-devnet-41233.galactica.com/',
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
      {
        name: 'ageProofZkKYC',
        circuit: 'test/test_ageProofZkKYC.circom',
        input: 'input/ageProofZkKYC.json',
      },
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
    ],
  },
};

/**
 * Gets the accounts for operation from the environment variables.
 * If they are not present, it will use random private keys (for example on the GitHub pipeline).
 *
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
  return accounts;
}

export default config;
