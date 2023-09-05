import { ethers } from 'hardhat';
import { VerificationSBT } from "../typechain-types/contracts/VerificationSBT";
import { getEddsaKeyFromEthSigner } from '../lib/keyManagement';
import { decryptFraudInvestigationData } from '../lib/SBTData';
import { buildEddsa } from "circomlibjs";
import { reconstructShamirSecret } from '../lib/shamirTools';



/**
 * @description Example script showing the fraud investigation process with 2 of 3 shamir secret sharing.
 */
async function main() {
    const verificationSBTAddr = "0x4E49d2383158568F5d4A30075e63614Dd7459060";
    const dAppAddr = "0xE3036b3b8484c1F5C39BA8390884FF7427434FC2";
    const userAddr = "0x53e173c619756eb6256d3ff4c7861bea5d739da1";

    const shamirN = 3;
    const shamirK = 2;

    // Get the private keys of the institutions
    // This part works differently for real fraud investigations because the private keys are held by different institutions.
    // So the shares would have to be decrypted by each institution, collected and then the secret can be reconstructed.
    // For this example we simplify it by having all private keys in one place.
    const [_, institution1, institution2, institution3] = await ethers.getSigners();

    const institutionShareNumber = new Map();
    institutionShareNumber.set(institution1.address, 1);
    institutionShareNumber.set(institution2.address, 2);
    institutionShareNumber.set(institution3.address, 3);

    const verificationSBT = await ethers.getContractAt("VerificationSBT", verificationSBTAddr) as VerificationSBT;

    const sbtInfo = await verificationSBT.getVerificationSBTInfo(userAddr, dAppAddr);

    const shares: string[] = [];
    const eddsa = await buildEddsa();
    for (const inst of [institution1, institution2, institution3]) {
        const shareNumber = institutionShareNumber.get(inst.address);
        const encryptedMsg = [
            sbtInfo.encryptedData[2 * (shareNumber - 1)],
            sbtInfo.encryptedData[2 * (shareNumber - 1) + 1],
        ];
        const userPubKey = sbtInfo.userPubKey.map((x) => eddsa.F.e(x.toString()));

        const galaPrivKey = BigInt(
            await getEddsaKeyFromEthSigner(inst)
        ).toString();

        const decryptedShare = await decryptFraudInvestigationData(
            galaPrivKey,
            userPubKey,
            encryptedMsg
        );

        shares.push(decryptedShare[0]);
        console.log(`Share ${shareNumber} decrypted: ${decryptedShare}`);
    }

    // only 2 of 3 shares are needed to reconstruct the secret
    const secret = reconstructShamirSecret(eddsa.F, shamirK, [
        [institutionShareNumber.get(institution1.address), shares[0]],
        [institutionShareNumber.get(institution2.address), shares[1]],
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