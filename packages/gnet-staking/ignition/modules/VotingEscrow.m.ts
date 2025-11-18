// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

import { defineUpgradableProxy } from './UpgradableProxy.m';

const VotingEscrowModule = buildModule('VotingEscrowModule', (module) => {
  const owner = module.getParameter('owner', module.getAccount(0));
  const penaltyRecipient = module.getParameter('penaltyRecipient', module.getAccount(0));
  const name = module.getParameter('name', 'veToken');
  const symbol = module.getParameter('symbol', 'veToken');

  const { upgradableContract: votingEscrow, proxyContracts } = defineUpgradableProxy(
    module,
    'VotingEscrow',
    [owner, penaltyRecipient, name, symbol],
  );

  return { votingEscrow, ...proxyContracts };
});

export default VotingEscrowModule;

