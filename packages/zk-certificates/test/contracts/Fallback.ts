import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract } from 'ethers';

describe.only('Fallback', () => {
  let fallbackContract: Contract;

  beforeEach(async () => {
    const Fallback = await ethers.getContractFactory('Fallback');
    fallbackContract = await Fallback.deploy();
    await fallbackContract.deployed();
  });

  it('should revert with correct error message when calling unsupported function', async () => {

    // Get the contract address and format it to match the expected error message format
    const fallbackWrongInterface = await ethers.getContractAt('MockToken', fallbackContract.address);

    // Call the contract with the non-existent function
    await expect(
      fallbackWrongInterface.transfer(fallbackContract.address, 1)
      ).to.be.revertedWith(`unsupported method ${fallbackContract.address.toLowerCase()}`);
  });
});
