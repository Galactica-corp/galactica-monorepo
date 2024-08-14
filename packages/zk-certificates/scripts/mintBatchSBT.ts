// eslint-disable-next-line import/no-extraneous-dependencies
import csv from 'csvtojson';
import { ethers } from 'hardhat';

/**
 * Performs some batch mint of SBTs.
 */
async function main() {
  // parameters for test interaction
  const [owner] = await ethers.getSigners();
  const SBTAddress = '0x499939a6C85a59E07939bfe2bF7DdcA031d0C9A1';

  const dataPath = './data/andromedaTest.csv';
  let data;

  await csv({ delimiter: ',' })
    .fromFile(dataPath)
    .then((jsonObj) => {
      data = jsonObj;
    });

  console.log('operating owner:', owner.address);

  const SBTInstance = await ethers.getContractAt(
    'GalacticaOfficialSBT',
    SBTAddress,
  );

  let dataArray = [];

  for (const user of data) {
    const userAddress = user['wallet'];
    const symbol = user['symbol'];
    const name = user['name'];
    const uri = user['metadata uri'];

    console.log(`Giving ${userAddress} an NFT with symbol ${symbol} and name ${name}`);
    console.log(`metadata uri is ${uri}`);

    dataArray.push(userAddress);
  }


  const tx = await SBTInstance.batchMint(dataArray);

  const receipt = await tx.wait();
  console.log(
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    `receipt ${receipt.transactionHash}, gas used ${receipt.gasUsed}`,)

  console.log(`Done`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
