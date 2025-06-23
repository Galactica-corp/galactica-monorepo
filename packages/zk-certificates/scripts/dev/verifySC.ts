import hre from 'hardhat';
/**
 * Verifies a smart contract after deployment.
 */
async function main() {
  const SCAddress = '0xebB99364d4615B7667560f89e28fBf56bE82BfE9';
  const constructorInputs = [
    '0x4d16D597BA3D144d62A557593443B0468E1A1D1a',
    '32',
    'Twitter ZkCertificate Registry',
  ];

  console.log(`verifying contract at address ${SCAddress}`);
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  console.log(`with constructor ${constructorInputs}`);

  await hre.run('verify:verify', {
    address: SCAddress,
    constructorArguments: constructorInputs,
    libraries: {
      PoseidonT3: '0x60337CE680b20D1fbc8b1205A5A8881F6ECdC2Db',
    },
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
