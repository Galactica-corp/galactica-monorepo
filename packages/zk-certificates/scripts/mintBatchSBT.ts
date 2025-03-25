// eslint-disable-next-line import/no-extraneous-dependencies
import csv from 'csvtojson';
import { ethers } from 'hardhat';

/**
 * Performs some batch mint of SBTs.
 */
async function main() {
  // parameters for test interaction
  const [owner] = await ethers.getSigners();
  const SBTAddress = '0x661A648830740DF27C6Bae82d710936032aF64D5';

  const dataPath = `/home/${process.env.USER}/Downloads/${SBTAddress}.csv`;
  console.log('dataPath', dataPath);
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

  const dataArray = [];

  for (const user of data) {
    const userAddress = user.wallet;
    console.log(
      `Giving ${userAddress} an NFT`,
    );
    dataArray.push(userAddress);
  }

  const batchSize = 300;
  // split dataArray into subarray of batchSize
  const batches = [];
  for (let i = 0; i < dataArray.length; i += batchSize) {
    batches.push(dataArray.slice(i, i + batchSize));
  }
  let batchNumber = 0;
  for (const batch of batches) {
    console.log(`minting batch number ${batchNumber}`);
    batchNumber += 1;
    console.log(`Minting batch of ${batch.length} addresses`);
    const tx = await SBTInstance.batchMint(batch);
    const receipt = await tx.wait();
    console.log(
      `receipt ${receipt.transactionHash
      }, gas used ${receipt.gasUsed.toString()}`,
    );
  }

  console.log(`Done`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
