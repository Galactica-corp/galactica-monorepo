import { network } from 'hardhat';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseEther, getAddress, zeroAddress } from 'viem';

import indexPoolModule from '../ignition/modules/IndexPool.m';
import testTokenModule from '../ignition/modules/TestToken.m';

describe('IndexPool', async function () {
  const { ignition, networkHelpers } = await network.connect();
  const { loadFixture } = networkHelpers;

  /**
   * @returns The deployed fixture
   */
  async function deployFixture() {
    const { viem } = await network.connect();
    const [owner, other] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();

    const { indexPool, gUBI } = await ignition.deploy(indexPoolModule, {
      parameters: {
        IndexPoolModule: {
          owner: owner.account.address,
        },
        TimelockControllerModule: {
          // set the timelock duration to 0, so that the upgrade can be executed immediately for the unittest
          minDelay: 0,
        },
      },
    });

    const { testToken } = await ignition.deploy(testTokenModule, {
      parameters: {
        TestTokenModule: {
          owner: owner.account.address,
        },
      },
    });

    return {
      indexPool,
      testToken,
      gUBI,
      owner,
      other,
      publicClient,
    };
  }

  describe('Deployment', async function () {
    it('Should set the right parameters', async function () {
      const { indexPool, owner, gUBI } = await loadFixture(deployFixture);

      const indexPoolOwner = await indexPool.read.owner();
      const indexTokenAddress = await indexPool.read.indexToken();

      assert.equal(
        indexPoolOwner.toLowerCase(),
        owner.account.address.toLowerCase(),
      );
      assert.equal(getAddress(indexTokenAddress), getAddress(gUBI.address));
    });

    it('Should fail to initialize twice', async function () {
      const { indexPool, gUBI, owner } = await loadFixture(deployFixture);

      await assert.rejects(
        async () => {
          await indexPool.write.initialize([
            gUBI.address,
            owner.account.address,
          ]);
        },
        (error: any) => {
          return error.message.includes('InvalidInitialization');
        },
      );
    });

    it('Should fail to initialize with invalid zero addresses', async function () {
      await assert.rejects(
        async () => {
          await ignition.deploy(indexPoolModule, {
            parameters: {
              IndexPoolModule: {
                owner: zeroAddress,
              },
              TimelockControllerModule: {
                minDelay: 0,
              },
            },
          });
        },
        (error: any) => {
          return (
            error.message.includes('InvalidOwnerAddress') ??
            error.message.includes('custom error')
          );
        },
      );
    });
  });

  describe('Token Management', function () {
    it('Should add a token', async function () {
      const { indexPool, testToken } = await loadFixture(deployFixture);

      await indexPool.write.addToken([testToken.address]);

      const heldTokens = await indexPool.read.getHeldTokens();

      assert.equal(heldTokens.length, 1);
      assert.equal(getAddress(heldTokens[0]), getAddress(testToken.address));
    });

    it('Should add a batch of tokens', async function () {
      const { indexPool, testToken, owner } = await loadFixture(deployFixture);

      const { testToken: otherToken } = await ignition.deploy(testTokenModule, {
        parameters: {
          TestTokenModule: {
            owner: owner.account.address,
          },
        },
      });

      await indexPool.write.addTokenBatch([
        [testToken.address, otherToken.address],
      ]);

      const heldTokens = await indexPool.read.getHeldTokens();

      assert.equal(heldTokens.length, 2);
      assert.equal(getAddress(heldTokens[0]), getAddress(testToken.address));
      assert.equal(getAddress(heldTokens[1]), getAddress(otherToken.address));
    });

    it('Should fail if not called by the owner', async function () {
      const { indexPool, testToken, other } = await loadFixture(deployFixture);

      await assert.rejects(
        async () => {
          await indexPool.write.addToken([testToken.address], {
            account: other.account,
          });
        },
        (error: any) => {
          return error.message.includes('OwnableUnauthorizedAccount');
        },
      );
    });
  });

  describe('Distribute Indexed Tokens', function () {
    /**
     * @param indexPool The index pool contract
     * @param owner The owner of the tokens
     * @returns Fixture with the tokens and the indexed amounts
     */
    async function loadIndexPool(indexPool: any, owner: any) {
      const { testToken: token1 } = await ignition.deploy(testTokenModule, {
        parameters: {
          TestTokenModule: {
            owner: owner.account.address,
          },
        },
      });

      const { testToken: token2 } = await ignition.deploy(testTokenModule, {
        parameters: {
          TestTokenModule: {
            owner: owner.account.address,
          },
        },
      });

      const { testToken: token3 } = await ignition.deploy(testTokenModule, {
        parameters: {
          TestTokenModule: {
            owner: owner.account.address,
          },
        },
      });

      await indexPool.write.addTokenBatch([
        [token1.address, token2.address, token3.address],
      ]);

      const indexedAmount1 = parseEther('10000000'); // 10 million
      const indexedAmount2 = parseEther('2000000'); // 2 million
      const indexedAmount3 = parseEther('3573573'); // ~3.5 million

      await token1.write.transfer([indexPool.address, indexedAmount1]);
      await token2.write.transfer([indexPool.address, indexedAmount2]);
      await token3.write.transfer([indexPool.address, indexedAmount3]);

      // get rid of the rest for simplicity in balance checks later
      // Transfer remaining balances to token1 contract (acts as a burn address)
      const token1Address = token1.address;
      for (const token of [token1, token2, token3]) {
        const balance = await token.read.balanceOf([owner.account.address]);
        if (balance > 0n) {
          await token.write.transfer([token1Address, balance]);
        }
      }

      return {
        token1,
        token2,
        token3,
        indexedAmount1,
        indexedAmount2,
        indexedAmount3,
      };
    }

    it('Should distribute tokens', async function () {
      const { indexPool, gUBI, owner } = await loadFixture(deployFixture);

      const {
        token1,
        token2,
        token3,
        indexedAmount1,
        indexedAmount2,
        indexedAmount3,
      } = await loadIndexPool(indexPool, owner);

      const burnAmount = parseEther('500');

      const totalSupply = await gUBI.read.totalSupply();

      const expectedPayout1 = (indexedAmount1 * burnAmount) / totalSupply;
      const expectedPayout2 = (indexedAmount2 * burnAmount) / totalSupply;
      const expectedPayout3 = (indexedAmount3 * burnAmount) / totalSupply;

      await gUBI.write.approve([indexPool.address, burnAmount]);

      const gUBIBalanceBefore = await gUBI.read.balanceOf([
        owner.account.address,
      ]);

      await indexPool.write.burnIndexToken([burnAmount]);

      const gUBIBalanceAfter = await gUBI.read.balanceOf([
        owner.account.address,
      ]);

      const totalSupplyAfter = await gUBI.read.totalSupply();

      assert.equal(gUBIBalanceAfter, gUBIBalanceBefore - burnAmount);
      assert.equal(totalSupplyAfter, gUBIBalanceBefore - burnAmount);

      const token1Balance = await token1.read.balanceOf([
        owner.account.address,
      ]);
      const token2Balance = await token2.read.balanceOf([
        owner.account.address,
      ]);
      const token3Balance = await token3.read.balanceOf([
        owner.account.address,
      ]);

      assert.equal(token1Balance, expectedPayout1);
      assert.equal(token2Balance, expectedPayout2);
      assert.equal(token3Balance, expectedPayout3);

      const token1PoolBalance = await token1.read.balanceOf([
        indexPool.address,
      ]);
      const token2PoolBalance = await token2.read.balanceOf([
        indexPool.address,
      ]);
      const token3PoolBalance = await token3.read.balanceOf([
        indexPool.address,
      ]);

      assert.equal(token1PoolBalance, indexedAmount1 - expectedPayout1);
      assert.equal(token2PoolBalance, indexedAmount2 - expectedPayout2);
      assert.equal(token3PoolBalance, indexedAmount3 - expectedPayout3);
    });

    it('Should distribute tokens with skipping feature', async function () {
      const { indexPool, gUBI, owner } = await loadFixture(deployFixture);

      const {
        token1,
        token2,
        token3,
        indexedAmount1,
        indexedAmount2,
        indexedAmount3,
      } = await loadIndexPool(indexPool, owner);

      // add a broken token to the index pool
      const brokenTokenAddress = getAddress(`0x${'1'.repeat(40)}`);
      await indexPool.write.addToken([brokenTokenAddress]);

      const burnAmount = parseEther('0.456789');

      const totalSupply = await gUBI.read.totalSupply();

      const expectedPayout1 = (indexedAmount1 * burnAmount) / totalSupply;
      const expectedPayout3 = (indexedAmount3 * burnAmount) / totalSupply;

      await gUBI.write.approve([indexPool.address, burnAmount]);

      // calling the distribution will revert because of the broken token
      await assert.rejects(async () => {
        await indexPool.write.burnIndexToken([burnAmount]);
      });

      const tokensToSkip = [token2.address, brokenTokenAddress];

      const gUBIBalanceBefore = await gUBI.read.balanceOf([
        owner.account.address,
      ]);

      await indexPool.write.burnIndexTokenAndSkipSomeTokens([
        burnAmount,
        tokensToSkip,
      ]);

      const gUBIBalanceAfter = await gUBI.read.balanceOf([
        owner.account.address,
      ]);

      const totalSupplyAfter = await gUBI.read.totalSupply();

      assert.equal(gUBIBalanceAfter, gUBIBalanceBefore - burnAmount);
      assert.equal(totalSupplyAfter, gUBIBalanceBefore - burnAmount);

      const token1Balance = await token1.read.balanceOf([
        owner.account.address,
      ]);
      const token2Balance = await token2.read.balanceOf([
        owner.account.address,
      ]);
      const token3Balance = await token3.read.balanceOf([
        owner.account.address,
      ]);

      assert.equal(token1Balance, expectedPayout1);
      assert.equal(token2Balance, 0n);
      assert.equal(token3Balance, expectedPayout3);

      const token1PoolBalance = await token1.read.balanceOf([
        indexPool.address,
      ]);
      const token2PoolBalance = await token2.read.balanceOf([
        indexPool.address,
      ]);
      const token3PoolBalance = await token3.read.balanceOf([
        indexPool.address,
      ]);

      assert.equal(token1PoolBalance, indexedAmount1 - expectedPayout1);
      assert.equal(token2PoolBalance, indexedAmount2);
      assert.equal(token3PoolBalance, indexedAmount3 - expectedPayout3);
    });

    it('Should fail to add tokens repeatedly', async function () {
      const { indexPool, testToken } = await loadFixture(deployFixture);

      await indexPool.write.addToken([testToken.address]);

      await assert.rejects(
        async () => {
          await indexPool.write.addToken([testToken.address]);
        },
        (error: any) => {
          return error.message.includes('TokenCanNotBeAddedTwice');
        },
      );
    });

    it('Should empty the pool completely', async function () {
      const { indexPool, testToken, gUBI, owner } =
        await loadFixture(deployFixture);

      const {
        token1,
        token2,
        token3,
        indexedAmount1,
        indexedAmount2,
        indexedAmount3,
      } = await loadIndexPool(indexPool, owner);

      const totalSupply = await gUBI.read.totalSupply();

      await gUBI.write.approve([indexPool.address, totalSupply]);
      await indexPool.write.burnIndexToken([totalSupply]);

      const totalSupplyAfter = await gUBI.read.totalSupply();
      const gUBIPoolBalance = await gUBI.read.balanceOf([indexPool.address]);
      const gUBIOwnerBalance = await gUBI.read.balanceOf([
        owner.account.address,
      ]);

      assert.equal(totalSupplyAfter, 0n);
      assert.equal(gUBIPoolBalance, 0n);
      assert.equal(gUBIOwnerBalance, 0n);

      for (const token of [token1, token2, token3, testToken]) {
        const poolBalance = await token.read.balanceOf([indexPool.address]);
        assert.equal(poolBalance, 0n);
      }

      const token1Balance = await token1.read.balanceOf([
        owner.account.address,
      ]);
      const token2Balance = await token2.read.balanceOf([
        owner.account.address,
      ]);
      const token3Balance = await token3.read.balanceOf([
        owner.account.address,
      ]);
      const testTokenBalance = await testToken.read.balanceOf([
        owner.account.address,
      ]);
      const testTokenTotalSupply = await testToken.read.totalSupply();

      assert.equal(token1Balance, indexedAmount1);
      assert.equal(token2Balance, indexedAmount2);
      assert.equal(token3Balance, indexedAmount3);
      assert.equal(testTokenBalance, testTokenTotalSupply);
    });

    it('Should fail with an incorrectly ordered skip tokens array', async function () {
      const { indexPool, owner, gUBI } = await loadFixture(deployFixture);
      const { token2, token3 } = await loadIndexPool(indexPool, owner);

      await gUBI.write.approve([indexPool.address, 1n]);
      await assert.rejects(
        async () => {
          await indexPool.write.burnIndexTokenAndSkipSomeTokens([
            1n,
            [token3.address, token2.address],
          ]);
        },
        (error: any) => {
          return error.message.includes(
            'SkipArrayNotInSameOrderAsHeldTokensArray',
          );
        },
      );
    });
  });
});
