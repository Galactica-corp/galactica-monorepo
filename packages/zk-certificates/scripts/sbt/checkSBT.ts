import { ethers } from 'hardhat';

/**
 * Performs some batch mint of SBTs.
 */
async function main() {
  // parameters for test interaction
  // const SBTAddress = '0xC1d40362A2e6c295DC53BAc79F65F81D030Da3Bd';
  // const SBTAddress = '0x75C47b5210658C6beFdDb23ab34B0B025979978e';
  // const SBTAddress = '0x589A65F4434c63A220DEDb050C3Cc03ee43fBF13';
  // const SBTAddress = '0x66Af9234673804B9c230f9AE0c6EB49cDfE93AFe';
  const SBTAddress = '0xe71D10f3065C3e2061eC044078297A0681868e78';

  const SBTInstance = await ethers.getContractAt(
    'GalacticaOfficialSBT',
    SBTAddress,
  );

  /*   const DEFAULT_ADMIN_ROLE = await SBTInstance.DEFAULT_ADMIN_ROLE();
  const ISSUER_ROLE = await SBTInstance.ISSUER_ROLE();

  const supposedAdmin = "0xd55935BD456E317EAFbA5B6c84B4aA77F1A0532e";
  const supposedIssuer = "0xD8fd391410FDEA9da4e899770860EaE2db09Deab";

  console.log(`SBT name is ${await SBTInstance.name()}`);
  console.log(`SBT symbol is ${await SBTInstance.symbol()}`);
  console.log(`check supposedAdmin ${await SBTInstance.hasRole(supposedAdmin, DEFAULT_ADMIN_ROLE)}`);
  console.log(`check supposedIssuer ${await SBTInstance.hasRole(supposedIssuer, ISSUER_ROLE)}`); */

  // const NFTID = '1127362652762616585699720001539547271958081669496';
  // const NFTID = '1410843013269580062388756009450372014991210708375'; // working XNET
  // const NFTID = '1127362652762616585699720001539547271958081669496';
  const NFTID = '4';

  const NFTURI = await SBTInstance.tokenURI(NFTID);
  console.log(`NFT URI is ${NFTURI}`);

  // change URI to test
  /* const newURI = "https://quicknode.quicknode-ipfs.com/ipfs/QmeJS1PdjBtbE77xgez7uBuPWg8ByJm3eFQsEpE8ffSE5g";
  const URIChangeTx = await SBTInstance.changeBaseURI(newURI);
  await URIChangeTx.wait();
  console.log("URI changed"); */

  const baseURI = await SBTInstance.tokenURIs(4);
  console.log(`baseURI is ${baseURI}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
