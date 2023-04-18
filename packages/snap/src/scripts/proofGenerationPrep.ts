import { readBinFile, readSection } from '@iden3/binfileutils';
import { Buffer } from 'buffer';
import * as fs from 'fs';
import path from 'path';
import { groth16, zKey } from 'snarkjs';
import { parse } from 'ts-command-line-args';

import { GenZkKycRequestParams } from '../types';

// Tell JSON how to serialize BigInts
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

/**
 * TestModified constructs and checks the zkKYC proof with the modified code of snarkjs that does not depend on file reading.
 *
 * @param circuitName - Name of the circuit to find the files.
 * @param circuitDir - Directory holding the .wasm and .zkey files.
 * @param params - Parameters to generate the proof with.
 */
async function testModified(
  circuitName: string,
  circuitDir: string,
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
      .readFileSync(path.join(circuitDir, `${circuitName}.vkey.json`))
      .toString(),
  );

  await verifyProof(proof, publicSignals, vKey);
}

/**
 * Because we can not read files inside the SES of a snap, we parse the data here
 * to have it in typescript and be able to pass it through the RPC endpoint.
 *
 * @param circuitName - Name of the circuit to find the files.
 * @param circuitDir - Directory holding the .wasm and .zkey files.
 * @param input - Input data TODO: remove this as the input data should be filled from the snap.
 * @returns The parameters to generate the proof with.
 */
async function createCircuitData(
  circuitName: string,
  circuitDir: string,
  input: any,
): Promise<GenZkKycRequestParams> {
  // read the wasm file asa array.
  // It becomes a Uint8Array later, but is passed as ordinary number array through the RPC
  const wasm = Uint8Array.from(
    fs.readFileSync(path.join(circuitDir, `${circuitName}.wasm`)),
  );

  const { fd: fdZKey, sections: sectionsZKey } = await readBinFile(
    path.join(circuitDir, `${circuitName}.zkey`),
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
  data.zkeyHeader.vk_alpha_1 = Buffer.from(data.zkeyHeader.vk_alpha_1).toString(
    'base64',
  );
  data.zkeyHeader.vk_beta_1 = Buffer.from(data.zkeyHeader.vk_beta_1).toString(
    'base64',
  );
  data.zkeyHeader.vk_beta_2 = Buffer.from(data.zkeyHeader.vk_beta_2).toString(
    'base64',
  );
  data.zkeyHeader.vk_gamma_2 = Buffer.from(data.zkeyHeader.vk_gamma_2).toString(
    'base64',
  );
  data.zkeyHeader.vk_delta_1 = Buffer.from(data.zkeyHeader.vk_delta_1).toString(
    'base64',
  );
  data.zkeyHeader.vk_delta_2 = Buffer.from(data.zkeyHeader.vk_delta_2).toString(
    'base64',
  );

  console.log(`curve name: ${JSON.stringify(data.zkeyHeader.curve.name)}`);
  // removing curve data because it would increase the transmission size dramatically and it can be reconstructed from the curve name
  data.zkeyHeader.curveName = data.zkeyHeader.curve.name;
  delete data.zkeyHeader.curve;

  const jsContent = {
    wasm: Buffer.from(data.wasm).toString('base64'),
    zkeyHeader: data.zkeyHeader,
    zkeySections: data.zkeySections,
  };
  console.log(
    `resulting JSON has size: ${
      JSON.stringify(jsContent).length / (1024 * 1024)
    } MB`,
  );

  fs.writeFileSync(filePath, JSON.stringify(jsContent));
  console.log(`Written to ${filePath}`);
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

type IProofGenPrepArguments = {
  circuitName: string;
  circuitsDir: string;
  testInput: string;
  output?: string;
  help?: boolean;
};

/**
 * Main function to run.
 */
async function main() {
  // proccess command line arguments
  const args = parse<IProofGenPrepArguments>(
    {
      circuitName: {
        type: String,
        description: 'Name of the circuit to generate the proof for',
      },
      circuitsDir: {
        type: String,
        description: 'Path to the directory containing the wasm and zkey files',
      },
      testInput: {
        type: String,
        description: 'Path to the input file to use for testing',
      },
      output: {
        type: String,
        optional: true,
        description:
          '(optional) Path to the output file to write the result to. Defaults to packages/site/public/provers/<name>.json',
        defaultValue: undefined,
      },
      help: {
        type: Boolean,
        optional: true,
        alias: 'h',
        description: 'Prints this usage guide',
      },
    },
    {
      helpArg: 'help',
      headerContentSections: [
        {
          header: 'Proof Generation Preparation',
          content:
            'Script for turning compile circom files into provers for the Galactica Snap.',
        },
      ],
      showHelpWhenArgsMissing: true,
    },
  );

  if (!args.output) {
    args.output = `${__dirname}/../../../site/public/provers/${args.circuitName}.json`;
  }
  if (!fs.existsSync(args.testInput)) {
    throw new Error(`Test input file ${args.testInput} does not exist.`);
  }
  if (!fs.existsSync(args.circuitsDir)) {
    throw new Error(`Circuit dir ${args.circuitsDir} does not exist.`);
  }
  if (!fs.existsSync(args.testInput)) {
    throw new Error(`Test input ${args.testInput} does not exist.`);
  }
  if (!fs.existsSync(path.dirname(args.output))) {
    throw new Error(`Target dir for ${args.output} does not exist.`);
  }

  const input = JSON.parse(fs.readFileSync(args.testInput).toString());

  // extract needed circuit data
  const params = await createCircuitData(
    args.circuitName,
    args.circuitsDir,
    input,
  );

  // await testStandard(input);
  await testModified(args.circuitName, args.circuitsDir, params);

  await writeCircuitDataToJSON(args.output, params);

  // copy vkey file to make it available for off-chain verification
  const vkeyPath = path.join(args.circuitsDir, `${args.circuitName}.vkey.json`);
  if (!fs.existsSync(vkeyPath)) {
    throw new Error(`Verification key ${vkeyPath} does not exist.`);
  }
  fs.copyFileSync(
    vkeyPath,
    path.join(path.dirname(args.output), `${args.circuitName}.vkey.json`),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
