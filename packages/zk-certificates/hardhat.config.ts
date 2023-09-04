import '@nomicfoundation/hardhat-toolbox';
import "@nomicfoundation/hardhat-chai-matchers";
import '@nomiclabs/hardhat-ethers';
import '@typechain/hardhat';
import 'hardhat-circom';
import { HardhatUserConfig } from 'hardhat/config';

import './tasks/createZKKYC';
import './tasks/smartCircuitBuild';


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
      url: "https://evm-rpc-http-devnet-41233.galactica.com/",  // requires gala dev wireguard connection
      accounts: [
        process.env.GalaTestnetDeployerPrivateKey!, // deployer
        process.env.GalaTestnetInstitution1PrivateKey!, // test institution for fraud investigation
        process.env.GalaTestnetInstitution2PrivateKey!, // test institution for fraud investigation
        process.env.GalaTestnetInstitution3PrivateKey!, // test institution for fraud investigation
      ],
    }
  },
  etherscan: {
    apiKey: {
      galaTestnet: "something"!, // not needed for now, I guess
    },
    customChains: [
      {
        network: "galaTestnet",
        chainId: 41233,
        urls: {
          apiURL: "https://explorer-devnet-41233.galactica.com/api",
          browserURL: "https://explorer-devnet-41233.galactica.com/"
        }
      }
    ]
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

export default config;
