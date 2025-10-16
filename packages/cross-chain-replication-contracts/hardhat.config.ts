import hardhatToolboxViemPlugin from '@nomicfoundation/hardhat-toolbox-viem';
import type { HardhatUserConfig } from 'hardhat/config';

// import { deployReplica } from './tasks/deployReplica.ts';

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      // used by hardhat script deploying with ignition
      default: {
        version: '0.8.28',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      production: {
        // used by `hardhat ignition deploy` should be the same as default
        version: '0.8.28',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: 'edr-simulated',
      chainType: 'l1',
    },
    hardhatOp: {
      type: 'edr-simulated',
      chainType: 'op',
    },
    sepolia: {
      type: 'http',
      chainType: 'l1',
      url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: process.env.GalaTestnetDeployerPrivateKey
        ? [process.env.GalaTestnetDeployerPrivateKey]
        : [],
    },
    arbitrumSepolia: {
      type: 'http',
      chainType: 'op',
      url: `https://arb-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: process.env.GalaTestnetDeployerPrivateKey
        ? [process.env.GalaTestnetDeployerPrivateKey]
        : [],
    },
    cassiopeia: {
      type: 'http',
      chainType: 'l1',
      url: `https://galactica-cassiopeia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: process.env.GalaTestnetDeployerPrivateKey
        ? [process.env.GalaTestnetDeployerPrivateKey]
        : [],
    },
  },
  verify: {
    etherscan: {
      apiKey: process.env.EtherscanApiKey ?? '',
    },
  },
  tasks: [
    // deployReplica,
  ],
  chainDescriptors: {
    421614: {
      name: 'arbitrumSepolia',
      blockExplorers: {
        etherscan: {
          apiUrl: 'https://api.etherscan.io/v2/api?chainid=421614',
          url: 'https://sepolia.arbiscan.io/',
        },
      },
    },
  },
  ignition: {
    strategyConfig: {
      create2: {
        salt: '0x0000000000000000000000000000000000000000000000000000000000000000',
      },
    },
  },
};

export default config;
