// eslint-disable-next-line import/no-extraneous-dependencies
import csv from 'csvtojson';
import { ethers } from 'hardhat';

/**
 * Performs some batch mint of SBTs
 */
async function main() {
  // parameters for test interaction
  const [owner] = await ethers.getSigners();
  const SBTAddress = '0xA10F4f2e6e881B876dF5cAfEF754F42d81606656';

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
    const name = user['SBT name'];
    const symbol = user['SBT name'];
    const uri = user['SBT description'];

    console.log(`Giving ${userAddress} an NFT`);
    const tx = await SBTInstance['mint(address,string,string,string)'](
      userAddress,
      name,
      symbol,
      uri,
    );

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
