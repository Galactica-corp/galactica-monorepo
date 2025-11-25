import hardhatToolboxViemPlugin from '@nomicfoundation/hardhat-toolbox-viem';
import type { HardhatUserConfig } from 'hardhat/config';

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    cassiopeia: {
      type: 'http',
      chainType: 'op',
      url: `https://galactica-cassiopeia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: process.env.GalaTestnetDeployerPrivateKey
        ? [process.env.GalaTestnetDeployerPrivateKey]
        : [],
    },
    galacticaMainnet: {
      type: 'http',
      chainType: 'op',
      url: `https://galactica-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: process.env.GnetMainnetDeployerPrivateKey
        ? [process.env.GnetMainnetDeployerPrivateKey]
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
    843843: {
      name: 'cassiopeia',
      blockExplorers: {
        etherscan: {
          apiUrl: 'https://galactica-cassiopeia.explorer.alchemy.com/api',
          url: 'https://galactica-cassiopeia.explorer.alchemy.com/',
        },
      },
    },
    613419: {
      name: 'galacticaMainnet',
      blockExplorers: {
        etherscan: {
          apiUrl: 'https://explorer.galactica.com/api',
          url: 'https://explorer.galactica.com/',
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
    requiredConfirmations: 1,
  },
};

export default config;
