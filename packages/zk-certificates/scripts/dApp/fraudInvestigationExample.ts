import { buildEddsa } from 'circomlibjs';
import { ethers } from 'hardhat';

import { getEddsaKeyFromEthSigner } from '../../lib/keyManagement';
import { decryptFraudInvestigationData } from '../../lib/SBTData';
import { reconstructShamirSecret } from '../../lib/shamirTools';

/**
 * Example script showing the fraud investigation process with 2 of 3 shamir secret sharing.
 */
async function main() {
  const verificationSBTAddr = '0x4E49d2383158568F5d4A30075e63614Dd7459060';
  const dAppAddr = '0xE3036b3b8484c1F5C39BA8390884FF7427434FC2';
  const userAddr = '0x53e173c619756eb6256d3ff4c7861bea5d739da1';

  // const shamirN = 3;
  const shamirK = 2;

  // Get the private keys of the institutions
  // This part works differently for real fraud investigations because the private keys are held by different institutions.
  // So the shares would have to be decrypted by each institution, collected and then the secret can be reconstructed.
  // For this example we simplify it by having all private keys in one place.
  const [institution1, institution2, institution3] = (
    await ethers.getSigners()
  ).slice(1, 4);

  const institutionShareNumber = new Map();
  institutionShareNumber.set(await institution1.getAddress(), 1);
  institutionShareNumber.set(await institution2.getAddress(), 2);
  institutionShareNumber.set(await institution3.getAddress(), 3);

  const verificationSBT = await ethers.getContractAt(
    'VerificationSBT',
    verificationSBTAddr,
  );

  const sbtInfo = await verificationSBT.getVerificationSBTInfo(
    userAddr,
    dAppAddr,
  );

  const shares: string[] = [];
  const eddsa = await buildEddsa();
  for (const inst of [institution1, institution2, institution3]) {
    const shareNumber = institutionShareNumber.get(
      await inst.getAddress(),
    ) as number;
    const encryptedMsg = [
      sbtInfo.encryptedData[2 * (shareNumber - 1)],
      sbtInfo.encryptedData[2 * (shareNumber - 1) + 1],
    ];
    const userPubKey = sbtInfo.userPubKey.map((value: any) =>
      eddsa.F.e(value.toString()),
    );

    const galaPrivKey = await getEddsaKeyFromEthSigner(inst);

    const decryptedShare = (await decryptFraudInvestigationData(
      galaPrivKey,
      userPubKey,
      encryptedMsg,
    )) as string[];

    shares.push(decryptedShare[0]);
    console.log(`Share ${shareNumber} decrypted: ${decryptedShare[0]}`);
  }

  // only 2 of 3 shares are needed to reconstruct the secret
  const secret = reconstructShamirSecret(eddsa.F, shamirK, [
    [institutionShareNumber.get(await institution1.getAddress()), shares[0]],
    [institutionShareNumber.get(await institution2.getAddress()), shares[1]],
  ]);

  console.log(``);
  console.log(`Reconstructed zkKYC DID: ${secret}`);
  // With this DID the fraud investigation consortium can go to the provider and query personal details of the user.
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
