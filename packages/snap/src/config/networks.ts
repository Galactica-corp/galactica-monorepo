import type { Chain } from 'viem';

export const reticulumChain: Chain = {
  id: 9302,
  name: 'Galactica-reticulum',
  nativeCurrency: {
    decimals: 18,
    name: 'Galactica',
    symbol: 'GNET',
  },
  rpcUrls: {
    default: {
      http: ['https://evm-rpc-http-reticulum.galactica.com'],
      webSocket: ['wss://evm-rpc-ws-reticulum.galactica.com'],
    },
    public: {
      http: ['https://evm-rpc-http-reticulum.galactica.com'],
      webSocket: ['wss://evm-rpc-ws-reticulum.galactica.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'BlockScout',
      url: 'https://explorer-reticulum.galactica.com',
    },
  },
  testnet: true,
} as const satisfies Chain;

export const galacticaCassiopeia: Chain = {
  id: 843843,
  name: 'Galactica Cassiopeia',
  nativeCurrency: {
    decimals: 18,
    name: 'Galactica',
    symbol: 'GNET',
  },
  rpcUrls: {
    default: {
      http: ['https://galactica-cassiopeia.g.alchemy.com/public'],
      // TODO: cassiopeia
      webSocket: [''],
    },
    public: {
      http: ['https://galactica-cassiopeia.g.alchemy.com/public'],
      webSocket: [''],
    },
  },
  blockExplorers: {
    default: {
      name: 'Galactica Cassiopeia explorer',
      url: 'https://galactica-cassiopeia.explorer.alchemy.com',
    },
  },
  testnet: true,
} as const satisfies Chain;

export const chainMap: Record<string, Chain> = {
  '9302': reticulumChain,
  '843843': galacticaCassiopeia,
};
