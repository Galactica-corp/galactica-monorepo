// eslint-disable-next-line import/no-extraneous-dependencies
import csv from 'csvtojson';
import { ethers } from 'hardhat';

/**
 * Performs some batch mint of SBTs.
 */
async function main() {
  // parameters for test interaction
  const [owner] = await ethers.getSigners();
  const SBTAddress = '0x3AC213B6F1A5a286Fc850f56DB020D2F9DC6acc3';

  const dataPath = './data/Equilibrium.csv';
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

  const batchSize = 300;
  //split dataArray into subarray of batchSize
  const batches = [];
  for (let i = 0; i < dataArray.length; i += batchSize) {
    batches.push(dataArray.slice(i, i + batchSize));
  }
  let batchNumber = 0;
  for (const batch of batches) {
    console.log(`minting batch number ${batchNumber}`);
    batchNumber++;
    console.log(`Minting batch of ${batch.length} addresses`);
    const tx = await SBTInstance.batchMint(batch);
    const receipt = await tx.wait();
    console.log(
      `receipt ${receipt.transactionHash}, gas used ${receipt.gasUsed}`,)
  }

  console.log(`Done`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
