import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { toBigInt } from 'ethers';
import hre, { ignition } from 'hardhat';

import updateTestGuardianRegistryModule from '../../ignition/modules/test/UpdateTestGuardianRegistry.m';
import type { UpgradeTestGuardianRegistry } from '../../typechain-types/contracts/test/UpgradeTestGuardianRegistry';

describe('Upgrade Guardian Registry', function () {
  let deployer: SignerWithAddress;
  let guardian: SignerWithAddress;

  beforeEach(async () => {
    [deployer, guardian] = await hre.ethers.getSigners();
  });

  /**
   * Deploy fixtures to work with the same setup in an efficient way.
   *
   * @returns Fixtures.
   */
  async function deploy() {
    const description = 'Test Guardian Registry';
    const testGuardian = {
      pubkey: [
        toBigInt(
          '15406969288470165023871038883559428361347771769942780978458824541644678347676',
        ),
        toBigInt(
          '20991550033662087418703288468635020238179240540666871457074661834730112436793',
        ),
      ],
      metadata: 'ipfs://QmbxKQbSU2kMRx3Q96JWFvezKVCKv8ik4twKg7SFktkrgx',
    };

    const { upgradedGuardianRegistry } = await ignition.deploy(
      updateTestGuardianRegistryModule,
      {
        parameters: {
          GuardianRegistryModule: {
            description,
          },
          UpgradedTestStakingModule: {
            newVersion: '2.0.0',
          },
        },
      },
    );

    return {
      upgradedGuardianRegistry:
        upgradedGuardianRegistry as unknown as UpgradeTestGuardianRegistry,
      description,
      testGuardian,
    };
  }

  describe('Deployment', function () {
    it('Should keep previous parameters', async function () {
      const { upgradedGuardianRegistry, description } =
        await loadFixture(deploy);

      expect(await upgradedGuardianRegistry.description()).to.equal(
        description,
      );
      expect(await upgradedGuardianRegistry.owner()).to.equal(deployer.address);
    });

    it('Should add new version field', async function () {
      const { upgradedGuardianRegistry } = await loadFixture(deploy);

      expect(await upgradedGuardianRegistry.version()).to.equal('2.0.0');
    });
  });

  describe('Should work as before', function () {
    it('should whitelist guardians', async function () {
      const { upgradedGuardianRegistry, testGuardian } =
        await loadFixture(deploy);

      // before adding a guardian, the guardian should not be in the list
      expect(await upgradedGuardianRegistry.isWhitelisted(guardian.address)).to
        .be.false;

      await upgradedGuardianRegistry.grantGuardianRole(
        guardian.address,
        [testGuardian.pubkey[0], testGuardian.pubkey[1]],
        testGuardian.metadata,
      );

      expect(await upgradedGuardianRegistry.isWhitelisted(guardian.address)).to
        .be.true;
    });

    it('should fail when another address tries to add a guardian', async function () {
      const { upgradedGuardianRegistry, testGuardian } =
        await loadFixture(deploy);
      await expect(
        upgradedGuardianRegistry
          .connect(guardian)
          .grantGuardianRole(
            guardian.address,
            [testGuardian.pubkey[0], testGuardian.pubkey[1]],
            testGuardian.metadata,
          ),
      ).to.be.revertedWithCustomError(
        upgradedGuardianRegistry,
        'OwnableUnauthorizedAccount',
      );
    });
  });
});
