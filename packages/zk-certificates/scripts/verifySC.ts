import hre from 'hardhat';
/**
 * Verifies a smart contract after deployment.
 */
async function main() {
  const SCAddress = '0x9eAC522f4C6DfF72dAdF09620A7A924C794E3FF2';
  const constructorInputs = [
    '0xD8fd391410FDEA9da4e899770860EaE2db09Deab',
    'https://quicknode.quicknode-ipfs.com/ipfs/QmbBJ6huNN6CHKpFoNoPBWJsKq6CwPH7VvKpw6Re5GAsRB',
    '0xd55935BD456E317EAFbA5B6c84B4aA77F1A0532e',
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
