import hre from 'hardhat';
/**
 * Verifies a smart contract after deployment.
 */
async function main() {
  const SCAddress = '0x6426f716BB18D1F6767766AecCA65349866954A3';
  const constructorInputs = [
    '0xC578b092204f48D34339fa76f8A2719817298978',
    'https://quicknode.quicknode-ipfs.com/ipfs/QmTWZSCpQwzEcjCa7sriwPXoJHjC9dTyy7P94cT4KkBvTm',
    '0xC578b092204f48D34339fa76f8A2719817298978',
    'Genesis SBT',
    'XNET'
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
