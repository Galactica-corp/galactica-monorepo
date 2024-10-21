// eslint-disable-next-line import/no-extraneous-dependencies
import { ethers } from 'hardhat';

/**
 * Performs some batch mint of SBTs.
 */
async function main() {
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
