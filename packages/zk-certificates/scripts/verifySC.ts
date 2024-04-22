import hre from 'hardhat';
/**
 * Verifies a smart contract after deployment.
 */
async function main() {
  const SCAddress = '0xCAFbc2D4a4E83ABD5A77391c8984B956c78001Af';
  const constructorInputs = [
    '0xb5e4A15F468AC505Bf0D53ceA2144b52135cCEF9',
    'twitter ZkCertificate',
  ];

  console.log(`verifying contract at address ${SCAddress}`);
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  console.log(`with constructor ${constructorInputs}`);

  await hre.run('verify:verify', {
    address: SCAddress,
    constructorArguments: constructorInputs,
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
