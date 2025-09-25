import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

import './tasks/stakingUpdate';

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.28',
      },
    ],
  },

  networks: {
    cassiopeia: {
      url: 'https://galactica-cassiopeia.g.alchemy.com/public',
      accounts: process.env.GalaTestnetDeployerPrivateKey
        ? [process.env.GalaTestnetDeployerPrivateKey]
        : [],
    },
    galacticaMainnet: {
      url: `https://galactica-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: process.env.GnetMainnetDeployerPrivateKey
        ? [process.env.GnetMainnetDeployerPrivateKey]
        : [],
    },
  },
  etherscan: {
    apiKey: {
      cassiopeia: process.env.ALCHEMY_API_KEY ?? '',
      galacticaMainnet: process.env.ALCHEMY_API_KEY ?? '',
    },
    customChains: [
      {
        network: 'cassiopeia',
        chainId: 843843,
        urls: {
          apiURL: 'https://galactica-cassiopeia.explorer.alchemy.com/api',
          browserURL: 'https://galactica-cassiopeia.explorer.alchemy.com/',
        },
      },
      {
        network: 'galacticaMainnet',
        chainId: 613419,
        urls: {
          apiURL: 'https://explorer.galactica.com/api',
          browserURL: 'https://explorer.galactica.com/',
        },
      },
    ],
  },
  ignition: {
    // setting required confirmations to 1 because cassiopeia only creates new blocks when there is a transaction
    requiredConfirmations: 1,
  },
};

export default config;
