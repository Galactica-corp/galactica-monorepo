// eslint-disable-next-line import/no-extraneous-dependencies
import csv from 'csvtojson';
import { ethers } from 'hardhat';

/**
 * Performs some test interactions with the NFT contract
 */
async function main() {
  // parameters for test interaction
  const [owner] = await ethers.getSigners();
  const SBTAddress = '0xe2300D7e670521b3FCC7E71e04262cB25a329171';

  const dataPath = './data/mockSBT.csv';
  let data;

  await csv({ delimiter: ';' })
    .fromFile(dataPath)
    .then((jsonObj) => {
      data = jsonObj;
    });

  console.log('operating owner:', owner.address);

  const SBTInstance = await ethers.getContractAt(
    'GalacticaTwitterSBT',
    SBTAddress,
  );

  for (const user of data) {
    const userAddress = user['wallet addresses'];

    console.log(`Giving ${userAddress} an NFT`);
    const tx = await SBTInstance.mint(userAddress);

    const receipt = await tx.wait();
    console.log(
      `receipt ${receipt.transactionHash}, gas used ${receipt.gasUsed}`,
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
