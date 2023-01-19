import { readBinFile, readSection } from '@iden3/binfileutils';
import { Buffer } from 'buffer';
import * as fs from 'fs';
import { groth16, zKey } from 'snarkjs';

import { GenZkKycRequestParams } from '../types';


/**
 * TestModified constructs and checks the zkKYC proof with the modified code of snarkjs that does not depend on file reading.
 *
 * @param circuitName - Name of the circuit to find the files.
 * @param params - Parameters to generate the proof with.
 */
async function testModified(
  circuitName: string,
  params: GenZkKycRequestParams,
) {
  const { proof, publicSignals } = await groth16.fullProveMemory(
    params.input,
    params.wasm,
    params.zkeyHeader,
    params.zkeySections,
  );

  console.log('Proof: ');
  console.log(JSON.stringify(proof, null, 1));

  const vKey = JSON.parse(
    fs
      .readFileSync(
        `${__dirname}/../../circuits/${circuitName}/${circuitName}.vkey.json`,
      )
      .toString(),
  );

  await verifyProof(proof, publicSignals, vKey);
}

/**
 * Because we can not read files inside the SES of a snap, we parse the data here
 * to have it in typescript and be able to pass it through the RPC endpoint.
 *
 * @param circuitName - Name of the circuit to find the files.
 * @param input - Input data TODO: remove this as the input data should be filled from the snap.
 * @returns The parameters to generate the proof with.
 */
async function createCircuitData(
  circuitName: string,
  input: any,
): Promise<GenZkKycRequestParams> {
  // read the wasm file asa array.
  // It becomes a Uint8Array later, but is passed as ordinary number array through the RPC
  const wasm = Uint8Array.from(
    fs.readFileSync(
      `${__dirname}/../../circuits/${circuitName}/${circuitName}.wasm`,
    ),
  );

  const { fd: fdZKey, sections: sectionsZKey } = await readBinFile(
    `${__dirname}/../../circuits/${circuitName}/${circuitName}.zkey`,
    'zkey',
    2,
    1 << 25,
    1 << 23,
  );
  const zkeyHeader = await zKey.readHeader(fdZKey, sectionsZKey);

  const zkeySections: any[] = [];
  for (let i = 4; i < 10; i++) {
    zkeySections.push(await readSection(fdZKey, sectionsZKey, i));
  }

  const params: GenZkKycRequestParams = {
    input,
    // dummy values
    wasm,
    zkeyHeader,
    zkeySections,
    requirements: {
      zkCertStandard: 'gip69',
    },
  };
  return params;
}

/**
 * To simplify reading the data in the frontend, we write it to a json file here.
 * TODO: solve this properly by providing the file in the frontend and let the frontend parse it.
 *
 * @param filePath - Path to write to.
 * @param data - Data to write.
 */
async function writeCircuitDataToJSON(
  filePath: string,
  data: GenZkKycRequestParams,
) {
  // format data for writing to file (othewise arrays look like objects)
  // using base64 encoding for Uint8Arrays to minimize file size while still being able to send it though the RPC in JSON format
  data.zkeyHeader.q = data.zkeyHeader.q.toString();
  data.zkeyHeader.r = data.zkeyHeader.r.toString();

  for (let i = 0; i < data.zkeySections.length; i++) {
    data.zkeySections[i] = Buffer.from(data.zkeySections[i]).toString('base64');
  }
  data.zkeyHeader.vk_alpha_1 = Buffer.from(data.zkeyHeader.vk_alpha_1).toString('base64');
  data.zkeyHeader.vk_beta_1 = Buffer.from(data.zkeyHeader.vk_beta_1).toString('base64');
  data.zkeyHeader.vk_beta_2 = Buffer.from(data.zkeyHeader.vk_beta_2).toString('base64');
  data.zkeyHeader.vk_gamma_2 = Buffer.from(data.zkeyHeader.vk_gamma_2).toString('base64');
  data.zkeyHeader.vk_delta_1 = Buffer.from(data.zkeyHeader.vk_delta_1).toString('base64');
  data.zkeyHeader.vk_delta_2 = Buffer.from(data.zkeyHeader.vk_delta_2).toString('base64');

  const jsContent = {
    wasm: Buffer.from(data.wasm).toString('base64'),
    zkeyHeader: data.zkeyHeader,
    zkeySections: data.zkeySections,
  };
  console.log(`resulting JSON has size: ${JSON.stringify(jsContent).length / (1024 * 1024)} MB`);

  fs.writeFile(
    filePath,
    JSON.stringify(jsContent),
    (error) => {
      if (error) {
        throw error;
      }
      console.log(`Written to ${filePath}`);
    },
  );
}

/**
 * Check if a generated  zkProof is valid.
 *
 * @param proof - Proof data.
 * @param publicSignals - Public signals.
 * @param vKey - Verification key.
 * @returns True if the proof is valid.
 */
async function verifyProof(proof: any, publicSignals: any, vKey: any) {
  const res = await groth16.verify(vKey, publicSignals, proof);
  if (res === true) {
    console.log('Proof valid');
  } else {
    console.log('Invalid proof!');
  }
  return res === true;
}

/**
 * Main function to run.
 */
async function main() {
  const circuitName = 'ageProofZkKYC';

  const input = JSON.parse(
    fs
      .readFileSync(
        `${__dirname}/../../circuits/${circuitName}/${circuitName}.input.json`,
      )
      .toString(),
  );

  // await testStandard(input);
  const params = await createCircuitData(circuitName, input);
  await testModified(circuitName, params);

  await writeCircuitDataToJSON(
    `${__dirname}/../../../../test/${circuitName}.json`,
    params,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
