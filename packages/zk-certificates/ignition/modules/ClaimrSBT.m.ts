// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const ClaimrSBTModule = buildModule('ClaimrSBTModule', (module) => {
  // Get deployer account
  const deployer = module.getAccount(0);

  // Parameters
  const signee = module.getParameter('signee', '0x333e271244f12351b6056130AEC894EB8AAf05C2');
  
  // Default SBT parameters (can be overridden via parameters file)
  const uri = module.getParameter('uri', 'ipfs://QmVG5b34f8DHGnPZQwi1GD4NUXEVhh7bTub5SG6MPHvHz6');
  const nftName = module.getParameter('nftName', 'Claimr Signed SBT');
  const nftSymbol = module.getParameter('nftSymbol', 'CLAIMR');

  // Deploy ClaimrSignedSBT
  const claimrSBT = module.contract('claimrSignedSBT', [
    nftName,
    nftSymbol,
    uri,
    signee,
  ]);

  return { claimrSBT };
});

export default ClaimrSBTModule;