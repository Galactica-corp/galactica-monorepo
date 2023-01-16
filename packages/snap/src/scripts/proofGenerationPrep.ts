import { readBinFile, readSection } from '@iden3/binfileutils';
import * as fs from 'fs';
import { groth16, zKey } from 'snarkjs';

import { GenZkKycRequestParams } from '../types';

/**
 * TestStandard tests the usual proof generation process of snarkjs to compare it to the one in the snap.
 *
 * @param circuitName - Name of the circuit to find the files.
 * @param input - Input data for the proof
 */
// async function testStandard(circuitName: string, input: any) {
//   const { proof, publicSignals } = await groth16.fullProve(
//     input,
//     `${__dirname}/../circuits/${circuitName}/${circuitName}.wasm`,
//     `${__dirname}/../circuits/${circuitName}/${circuitName}.zkey`,
//   );

//   console.log('Proof: ');
//   console.log(JSON.stringify(proof, null, 1));

//   const vKey = JSON.parse(
//     fs
//       .readFileSync(
//         `${__dirname}/../circuits/${circuitName}/${circuitName}.vkey.json`,
//       )
//       .toString(),
//   );

//   await verifyProof(proof, publicSignals, vKey);
// }

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
  // TODO: use more efficient encoding
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
 * To simplify reading the data in the frontend, we write it to a ts file here.
 * TODO: solve this properly by providing the file in the frontend and let the frontend parse it.
 *
 * @param filePath - Path to write to.
 * @param data - Data to write.
 */
async function writeCircuitDataToTSFile(
  filePath: string,
  data: GenZkKycRequestParams,
) {
  // format data for writing to file (othewise arrays look like objects)
  data.zkeyHeader.q = data.zkeyHeader.q.toString();
  data.zkeyHeader.r = data.zkeyHeader.r.toString();
  for (let i = 0; i < data.zkeySections.length; i++) {
    data.zkeySections[i] = uint8ArrayToJSArray(data.zkeySections[i]);
  }
  data.zkeyHeader.vk_alpha_1 = uint8ArrayToJSArray(data.zkeyHeader.vk_alpha_1);
  data.zkeyHeader.vk_beta_1 = uint8ArrayToJSArray(data.zkeyHeader.vk_beta_1);
  data.zkeyHeader.vk_beta_2 = uint8ArrayToJSArray(data.zkeyHeader.vk_beta_2);
  data.zkeyHeader.vk_gamma_2 = uint8ArrayToJSArray(data.zkeyHeader.vk_gamma_2);
  data.zkeyHeader.vk_delta_1 = uint8ArrayToJSArray(data.zkeyHeader.vk_delta_1);
  data.zkeyHeader.vk_delta_2 = uint8ArrayToJSArray(data.zkeyHeader.vk_delta_2);

  let fileContent = `export const wasm = ${JSON.stringify(
    uint8ArrayToJSArray(data.wasm),
  )};\n`;
  fileContent += `export const zkeyHeader = ${JSON.stringify(
    data.zkeyHeader,
  )};\n`;
  fileContent += `export const zkeySections = ${JSON.stringify(
    data.zkeySections,
  )};\n`;
  fs.writeFile(filePath, fileContent, (error) => {
    if (error) {
      throw error;
    }
    console.log(`Written to ${filePath}`);
  });

  const jsContent = {
    wasm: uint8ArrayToJSArray(data.wasm),
    zkeyHeader: data.zkeyHeader,
    zkeySections: data.zkeySections,
  };
  fs.writeFile(
    filePath.replace('.ts', '.json'),
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

  await writeCircuitDataToTSFile(
    `${__dirname}/../../../../test/${circuitName}check.ts`,
    params,
  );
}

/**
 * Transforms a Uint8Array to a number array.
 *
 * @param arr - Uint8Array to transform.
 * @returns The number array.
 */
function uint8ArrayToJSArray(arr: Uint8Array) {
  const res: number[] = [];
  for (const i of arr) {
    res.push(arr[i]);
  }
  return res;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
