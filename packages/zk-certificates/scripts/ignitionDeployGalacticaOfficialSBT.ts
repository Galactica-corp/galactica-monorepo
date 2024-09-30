import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";


const GalacticaOfficialSBTModule = buildModule("GalacticaOfficialSBTModule", (m) => {

  const [deployer] = await ethers.getSigners();

  console.log(
    `Deploying contracts with account ${deployer.address} on network ${network.name}`,
  );

  console.log(`Account balance: ${(await deployer.getBalance()).toString()}`);

  let issuer = deployer.address;
  let owner = deployer.address;
    const uri =
      'https://quicknode.quicknode-ipfs.com/ipfs/QmTWZSCpQwzEcjCa7sriwPXoJHjC9dTyy7P94cT4KkBvTm';
    const nftName = 'Genesis SBT';
    const nftSymbol = 'XNET';

    const GalacticaOfficialSBT = m.contract(
      'GalacticaOfficialSBT',
      [issuer, uri, owner, nftName, nftSymbol],
      {},
    );

    return { GalacticaOfficialSBT };
});

export default GalacticaOfficialSBTModule;