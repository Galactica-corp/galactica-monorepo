// eslint-disable-next-line import/no-extraneous-dependencies
import { ethers } from 'hardhat';

/**
 * Performs some batch mint of SBTs.
 */
async function main() {
  // parameters for test interaction
  // const SBTAddress = '0xC1d40362A2e6c295DC53BAc79F65F81D030Da3Bd';
  // const SBTAddress = '0x75C47b5210658C6beFdDb23ab34B0B025979978e';
  // const SBTAddress = '0x589A65F4434c63A220DEDb050C3Cc03ee43fBF13';
  const ZkCertificateRegistryAddress =
    '0xc2032b11b79B05D1bd84ca4527D2ba8793cB67b2';

  const ZkCertificateRegistryInstance = await ethers.getContractAt(
    'ZkCertificateRegistry',
    ZkCertificateRegistryAddress,
  );

  const GuardianRegistryAddress =
    await ZkCertificateRegistryInstance._GuardianRegistry();
  console.log(`GuardianRegistryAddress is ${GuardianRegistryAddress}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
