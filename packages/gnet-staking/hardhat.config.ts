import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

// Import task files to make them available
import './tasks/stakingUpdate';
import './tasks/changeUnstakingFee';

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
  },
  etherscan: {
    apiKey: {
      cassiopeia: process.env.ALCHEMY_API_KEY ?? '',
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
    ],
  },
  ignition: {
    // setting required confirmations to 1 because cassiopeia only creates new blocks when there is a transaction
    requiredConfirmations: 1,
  },
};

export default config;
