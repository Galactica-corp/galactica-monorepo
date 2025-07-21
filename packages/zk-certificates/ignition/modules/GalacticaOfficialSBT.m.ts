// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const GalacticaOfficialSBTModule = buildModule('GalacticaOfficialSBTModule', (module) => {
  // Get deployer account
  const deployer = module.getAccount(0);

  // SBT parameters with defaults
  const issuer = module.getParameter('issuer', deployer);
  const owner = module.getParameter('owner', deployer);
  const uri = module.getParameter('uri', 'https://quicknode.quicknode-ipfs.com/ipfs/QmeJS1PdjBtbE77xgez7uBuPWg8ByJm3eFQsEpE8ffSE5g');
  const nftName = module.getParameter('nftName', 'Guilding Galactica - Top 10 (GG10)');
  const nftSymbol = module.getParameter('nftSymbol', 'GG10');

  // Deploy GalacticaOfficialSBT
  const galacticaOfficialSBT = module.contract('GalacticaOfficialSBT', [
    issuer,
    uri,
    owner,
    nftName,
    nftSymbol,
  ]);

  return { galacticaOfficialSBT };
});

export default GalacticaOfficialSBTModule;