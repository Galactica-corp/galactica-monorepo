/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';

describe('GuardianRegistry', () => {
  let deployer: SignerWithAddress;
  let guardian: SignerWithAddress;
  let additionalIssuer: SignerWithAddress;

  beforeEach(async () => {
    [deployer, guardian, additionalIssuer] = await hre.ethers.getSigners();
  });

  /**
   * Deploy fixtures to work with the same setup in an efficient way.
   * @returns Fixtures.
   */
  async function deploy() {
    const description = 'Test Guardian Registry';
    const testGuardian = {
      pubkey: [
        15406969288470165023871038883559428361347771769942780978458824541644678347676n,
        20991550033662087418703288468635020238179240540666871457074661834730112436793n,
      ],
      metadata: 'ipfs://QmbxKQbSU2kMRx3Q96JWFvezKVCKv8ik4twKg7SFktkrgx',
    };

    const GuardianRegistryFactory =
      await ethers.getContractFactory('GuardianRegistry');
    const GuardianRegistry =
      await GuardianRegistryFactory.connect(deployer).deploy(description);

    return {
      GuardianRegistry,
      description,
      testGuardian,
    };
  }

  it('should be able to deploy', async function () {
    const { GuardianRegistry, description } = await loadFixture(deploy);

    // Check that all the data is set and accessible
    expect(await GuardianRegistry.description()).to.equal(description);
  });

  it('should whitelist guardians', async function () {
    const { GuardianRegistry, testGuardian } = await loadFixture(deploy);

    // before adding a guardian, the guardian should not be in the list
    expect(await GuardianRegistry.isWhitelisted(guardian.address)).to.be.false;

    await GuardianRegistry.grantGuardianRole(
      guardian.address,
      testGuardian.pubkey,
      testGuardian.metadata,
    );

    expect(await GuardianRegistry.isWhitelisted(guardian.address)).to.be.true;
  });

  it('should fail when another address tries to add a guardian', async function () {
    const { GuardianRegistry, testGuardian } = await loadFixture(deploy);
    await expect(
      GuardianRegistry.connect(guardian).grantGuardianRole(
        guardian.address,
        testGuardian.pubkey,
        testGuardian.metadata,
      ),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should allow guardians to renounce their role', async function () {
    const { GuardianRegistry, testGuardian } = await loadFixture(deploy);
    await GuardianRegistry.grantGuardianRole(
      guardian.address,
      testGuardian.pubkey,
      testGuardian.metadata,
    );

    expect(await GuardianRegistry.isWhitelisted(guardian.address)).to.be.true;
    await GuardianRegistry.connect(guardian).renounceGuardianRole();
    expect(await GuardianRegistry.isWhitelisted(guardian.address)).to.be.false;

    await expect(
      GuardianRegistry.connect(additionalIssuer).renounceGuardianRole(),
    ).to.be.revertedWith(
      'GuardianRegistry: Only guardians may renounce their role',
    );
  });

  it('should manage issuer accounts of a guardian', async function () {
    const { GuardianRegistry, testGuardian } = await loadFixture(deploy);

    await GuardianRegistry.grantGuardianRole(
      guardian.address,
      testGuardian.pubkey,
      testGuardian.metadata,
    );

    // before adding an issuer, the issuer should not be in the list
    expect(await GuardianRegistry.isWhitelisted(additionalIssuer.address)).to.be
      .false;

    await GuardianRegistry.connect(guardian).addIssuerAccount(
      additionalIssuer.address,
    );

    expect(await GuardianRegistry.isWhitelisted(additionalIssuer.address)).to.be
      .true;

    await GuardianRegistry.connect(guardian).removeIssuerAccount(
      additionalIssuer.address,
    );

    expect(await GuardianRegistry.isWhitelisted(additionalIssuer.address)).to.be
      .false;
  });

  it('should fail to manage other guardians issuers', async function () {
    const { GuardianRegistry, testGuardian } = await loadFixture(deploy);

    for (const account of [guardian, deployer]) {
      await GuardianRegistry.grantGuardianRole(
        account.address,
        testGuardian.pubkey,
        testGuardian.metadata,
      );
    }

    await expect(
      GuardianRegistry.connect(additionalIssuer).addIssuerAccount(
        additionalIssuer.address,
      ),
    ).to.be.revertedWith(
      'GuardianRegistry: Only guardian admins may add issuer accounts',
    );

    await GuardianRegistry.connect(guardian).addIssuerAccount(
      additionalIssuer.address,
    );

    await expect(
      GuardianRegistry.connect(deployer).removeIssuerAccount(
        additionalIssuer.address,
      ),
    ).to.be.revertedWith(
      'GuardianRegistry: Only guardian admin may remove this issuer accounts',
    );
  });

  it('should not whitelist issuers whose guardian was revoked', async function () {
    const { GuardianRegistry, testGuardian } = await loadFixture(deploy);

    await GuardianRegistry.grantGuardianRole(
      guardian.address,
      testGuardian.pubkey,
      testGuardian.metadata,
    );

    await GuardianRegistry.connect(guardian).addIssuerAccount(
      additionalIssuer.address,
    );

    await GuardianRegistry.connect(deployer).revokeGuardianRole(
      guardian.address,
    );

    expect(await GuardianRegistry.isWhitelisted(additionalIssuer.address)).to.be
      .false;
  });

  it('should fail to hijack other issuers', async function () {
    const { GuardianRegistry, testGuardian } = await loadFixture(deploy);

    for (const account of [guardian, deployer]) {
      await GuardianRegistry.grantGuardianRole(
        account.address,
        testGuardian.pubkey,
        testGuardian.metadata,
      );
    }

    await GuardianRegistry.connect(guardian).addIssuerAccount(
      additionalIssuer.address,
    );

    await expect(
      GuardianRegistry.connect(deployer).addIssuerAccount(
        additionalIssuer.address,
      ),
    ).to.be.revertedWith(
      'GuardianRegistry: Issuer may not belong to multiple guardians',
    );
  });
});
