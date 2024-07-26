// eslint-disable-next-line import/no-extraneous-dependencies
import csv from 'csvtojson';
import { ethers } from 'hardhat';

/**
 * Performs some batch mint of SBTs.
 */
async function main() {
  // parameters for test interaction
  const [owner] = await ethers.getSigners();
  // const SBTAddress = '0xC1d40362A2e6c295DC53BAc79F65F81D030Da3Bd';
  const SBTAddress = '0x75C47b5210658C6beFdDb23ab34B0B025979978e';
  //const SBTAddress = '0x589A65F4434c63A220DEDb050C3Cc03ee43fBF13';

  const SBTInstance = await ethers.getContractAt(
    'GalacticaOfficialSBT',
    SBTAddress,
  );

  const DEFAULT_ADMIN_ROLE = await SBTInstance.DEFAULT_ADMIN_ROLE();
  const ISSUER_ROLE = await SBTInstance.ISSUER_ROLE();

  const supposedAdmin = "0xd55935BD456E317EAFbA5B6c84B4aA77F1A0532e";
  const supposedIssuer = "0xD8fd391410FDEA9da4e899770860EaE2db09Deab";

  console.log(`SBT name is ${await SBTInstance.name()}`);
  console.log(`SBT symbol is ${await SBTInstance.symbol()}`);
  console.log(`check supposedAdmin ${await SBTInstance.hasRole(supposedAdmin, DEFAULT_ADMIN_ROLE)}`);
  console.log(`check supposedIssuer ${await SBTInstance.hasRole(supposedIssuer, ISSUER_ROLE)}`);

  // const NFTID = '1127362652762616585699720001539547271958081669496';
  // const NFTID = '1410843013269580062388756009450372014991210708375'; // working XNET
  // const NFTID = '1127362652762616585699720001539547271958081669496';

  //const NFTURI = await SBTInstance.tokenURI(NFTID);
  // console.log(`NFT URI is ${NFTURI}`);

  // change URI to test
  // const newURI = "https://mike-tis.github.io/XNET-SBT/content.json";
  /* await SBTInstance.setTokenURI(NFTID, 'test'); */
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
