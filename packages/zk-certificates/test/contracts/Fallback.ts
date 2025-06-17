import { expect } from 'chai';
import { ethers } from 'hardhat';

import type { Fallback } from '../../typechain-types';

describe('Fallback', () => {
  let fallbackContract: Fallback;

  beforeEach(async () => {
    fallbackContract = await ethers.deployContract('Fallback');
    await fallbackContract.waitForDeployment();
  });

  it('should revert with correct error message when calling unsupported function', async () => {
    // Get the contract address and format it to match the expected error message format
    const fallbackWrongInterface = await ethers.getContractAt(
      'MockToken',
      await fallbackContract.getAddress(),
    );

    await expect(
      fallbackWrongInterface.transfer(await fallbackContract.getAddress(), 1),
    ).to.be.revertedWith(
      `unsupported method ${(
        await fallbackContract.getAddress()
      ).toLowerCase()}`,
    );
  });
});
