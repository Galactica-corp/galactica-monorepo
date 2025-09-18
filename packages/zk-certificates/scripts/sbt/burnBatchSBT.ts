import csv from 'csvtojson';
import { ethers } from 'hardhat';

/**
 * Performs some batch mint of SBTs.
 */
async function main() {
  // parameters for test interaction
  const [owner] = await ethers.getSigners();
  const SBTAddress = '0x0ff7190902556b4038506aA8810360889d0A4902';

  const dataPath = './data/Gulding SBTs MERGED - GG Participant.csv';
  const data = await csv({ delimiter: ',' })
    .fromFile(dataPath)
    .then((jsonObj) => {
      return jsonObj as any;
    });

  console.log('operating owner:', await owner.getAddress());

  const SBTInstance = await ethers.getContractAt(
    'GalacticaTwitterSBT',
    SBTAddress,
  );

  for (const user of data) {
    const userAddress = user.wallet;

    console.log(`burning NFT from ${userAddress}`);
    try {
      const tx = await SBTInstance.burn(userAddress);

      const receipt = await tx.wait();
      console.log(
        `receipt ${receipt.transactionHash}, gas used ${receipt.gasUsed}`,
      );
    } catch (error) {
      console.log(error);
    }
  }

  console.log(`Done`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
