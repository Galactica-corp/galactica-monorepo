import { network } from 'hardhat';

/**
 * Script for relaying state updates from the origin chain to the destination chain.
 * 
 * To be migrated to a task later.
 */

// arguments
const originChain = 'arbitrumSepolia';
const originChainType = 'op';
const senderAddress = '0x42c6C0610cA7097BC96a4607Ba4FDf5845d8BBA6';


const origin = await network.connect({
  network: originChain,
  chainType: originChainType,
});


console.log('Calling relayState function on sender');

const sender = await origin.viem.getContractAt('RegistryStateSender', senderAddress);
const dispatchFee = await sender.read.quoteRelayFee();
console.log('Dispatch fee:', dispatchFee);
const tx = await sender.write.relayState({ value: dispatchFee });
console.log('Transaction sent:', tx);

console.log('Done');
