import { buildEddsa } from 'circomlibjs';
import { writeFileSync } from 'fs';
import hre from 'hardhat';
import { join } from 'path';

import { getEddsaKeyFromEthSigner } from '../lib/keyManagement';

/**
 * Script to generate institution pubkeys and write them to a parameter file.
 * This generates proper EdDSA pubkeys for institutions instead of using dummy values.
 */
async function main() {
  console.log('Generating institution pubkeys...');

  const [deployer, institution1, institution2, institution3] =
    await hre.ethers.getSigners();

  const eddsa = await buildEddsa();

  // Make the code generic and reusable for any number of institutions
  const institutions = [
    { name: 'deployer', signer: deployer },
    { name: 'institution1', signer: institution1 },
    { name: 'institution2', signer: institution2 },
    { name: 'institution3', signer: institution3 },
  ];

  console.log('Institution addresses:');
  institutions.forEach((inst, idx) => {
    console.log(`Institution ${idx + 1}: ${inst.signer.address}`);
  });

  // Helper to convert pubkey to decimal strings
  const convertPubkeyToDecimal = (pubKey: Uint8Array[]) => {
    return pubKey.map((key: Uint8Array) =>
      eddsa.poseidon.F.toObject(key).toString(),
    );
  };

  // Generate privkeys, pubkeys, and decimal pubkeys for each institution
  const institutionData: Record<string, { address: string; pubkey: string[] }> =
    {};
  for (const inst of institutions) {
    const privKey = await getEddsaKeyFromEthSigner(inst.signer);
    const pubKey = eddsa.prv2pub(privKey);
    const pubKeyDecimal = convertPubkeyToDecimal(pubKey);

    institutionData[inst.name] = {
      address: inst.signer.address,
      pubkey: pubKeyDecimal,
    };
  }

  console.log('\nInstitution pubkeys (decimal format):');
  institutions.forEach((inst, idx) => {
    const { pubkey } = institutionData[inst.name];
    console.log(`Institution ${idx + 1}: [${pubkey.join(', ')}]`);
  });

  const jsonOutput = {
    institutions: institutionData,
  };

  // Write to the parameter file
  const outputPath = join(
    __dirname,
    '../ignition/params/institution_pubkeys.json',
  );
  writeFileSync(outputPath, JSON.stringify(jsonOutput, null, 2));

  console.log(`\nInstitution pubkeys written to: ${outputPath}`);
  console.log('Generated pubkeys for 3 institutions.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
