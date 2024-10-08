// SPDX-License-Identifier: MIT
import type { GenZkProofParams, ProverData } from '@galactica-net/snap-api';
import { ZkCertStandard } from '@galactica-net/snap-api';
import { readBinFile, readSection } from '@iden3/binfileutils';
import { Buffer } from 'buffer';
import * as fs from 'fs';
import hash from 'object-hash';
import path from 'path';
import { groth16, zKey } from 'snarkjs';
import { parse } from 'ts-command-line-args';

import {
  subPathWasm,
  subPathZkeyHeader,
  subPathZkeySections,
} from '../proofGenerator';

// Tell JSON how to serialize BigInts
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

/**
 * TestModified constructs and checks the zkKYC proof with the modified code of snarkjs that does not depend on file reading.
 * @param circuitName - Name of the circuit to find the files.
 * @param circuitDir - Directory holding the .wasm and .zkey files.
 * @param params - Parameters to generate the proof with.
 */
async function testModified(
  circuitName: string,
  circuitDir: string,
  params: GenZkProofParams<any>,
) {
  const prover = params.prover as ProverData;
  const { proof, publicSignals } = await groth16.fullProveMemory(
    params.input,
    prover.wasm,
    prover.zkeyHeader,
    prover.zkeySections,
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
 * @param circuitName - Name of the circuit to find the files.
 * @param circuitDir - Directory holding the .wasm and .zkey files.
 * @param input - Input data for testing if the generation works.
 * @returns The parameters to generate the proof with.
 */
async function createCircuitData(
  circuitName: string,
  circuitDir: string,
  input: any,
): Promise<GenZkProofParams<any>> {
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

  const params: GenZkProofParams<any> = {
    input,
    // dummy values
    prover: {
      wasm,
      zkeyHeader,
      zkeySections,
    },
    requirements: {
      zkCertStandard: ZkCertStandard.ZkKYC,
      registryAddress: '0x0',
    },
    userAddress: '0x0',
    description: 'test',
    publicInputDescriptions: [],
    zkInputRequiresPrivKey: true,
  };
  return params;
}

/**
 * To simplify reading the data in the frontend, we write it to a json file here.
 * Then it can be imported on demand to be uploaded to the snap.
 * @param filePath - Path to write to.
 * @param prover - Prover data to write.
 */
async function writeCircuitDataToJSON(filePath: string, prover: ProverData) {
  // format data for writing to file (othewise arrays look like objects)
  // using base64 encoding for Uint8Arrays to minimize file size while still being able to send it though the RPC in JSON format
  prover.zkeyHeader.q = prover.zkeyHeader.q.toString();
  prover.zkeyHeader.r = prover.zkeyHeader.r.toString();

  for (let i = 0; i < prover.zkeySections.length; i++) {
    prover.zkeySections[i] = Buffer.from(prover.zkeySections[i]).toString(
      'base64',
    );
  }
  prover.zkeyHeader.vk_alpha_1 = Buffer.from(
    prover.zkeyHeader.vk_alpha_1,
  ).toString('base64');
  prover.zkeyHeader.vk_beta_1 = Buffer.from(
    prover.zkeyHeader.vk_beta_1,
  ).toString('base64');
  prover.zkeyHeader.vk_beta_2 = Buffer.from(
    prover.zkeyHeader.vk_beta_2,
  ).toString('base64');
  prover.zkeyHeader.vk_gamma_2 = Buffer.from(
    prover.zkeyHeader.vk_gamma_2,
  ).toString('base64');
  prover.zkeyHeader.vk_delta_1 = Buffer.from(
    prover.zkeyHeader.vk_delta_1,
  ).toString('base64');
  prover.zkeyHeader.vk_delta_2 = Buffer.from(
    prover.zkeyHeader.vk_delta_2,
  ).toString('base64');

  console.log(`curve name: ${JSON.stringify(prover.zkeyHeader.curve.name)}`);
  // removing curve data because it would increase the transmission size dramatically and it can be reconstructed from the curve name
  prover.zkeyHeader.curveName = prover.zkeyHeader.curve.name;
  delete prover.zkeyHeader.curve;

  const jsContent = {
    wasm: Buffer.from(prover.wasm).toString('base64'),
    zkeyHeader: prover.zkeyHeader,
    zkeySections: prover.zkeySections,
  };
  console.log(
    `resulting JSON has size: ${
      JSON.stringify(jsContent).length / (1024 * 1024)
    } MB`,
  );

  fs.writeFileSync(filePath, JSON.stringify(jsContent));
  console.log(`Written whole prover to ${filePath}`);

  // also write prover parts so large provers can be split up and downloaded in parts
  const proverDir = path.join(
    path.dirname(filePath),
    path.basename(filePath, '.json'),
  );
  if (!fs.existsSync(proverDir)) {
    fs.mkdirSync(proverDir);
  }
  fs.writeFileSync(
    path.join(proverDir, subPathWasm),
    JSON.stringify(jsContent.wasm),
  );
  // add length of sections to header so the snap knows how many parts to expect
  jsContent.zkeyHeader.sectionsLength = prover.zkeySections.length;
  fs.writeFileSync(
    path.join(proverDir, subPathZkeyHeader),
    JSON.stringify(jsContent.zkeyHeader),
  );
  const sectionsDir = path.dirname(
    path.join(proverDir, subPathZkeySections(0)),
  );
  if (!fs.existsSync(sectionsDir)) {
    fs.mkdirSync(sectionsDir);
  }
  for (let i = 0; i < prover.zkeySections.length; i++) {
    fs.writeFileSync(
      path.join(proverDir, subPathZkeySections(i)),
      JSON.stringify(prover.zkeySections[i]),
    );
  }
  console.log(`Written prover parts to ${proverDir}`);

  // save hash for verification
  delete jsContent.zkeyHeader.sectionsLength;
  const proverHash = hash.MD5(jsContent);
  console.log(`Prover hash: ${proverHash}`);
  fs.writeFileSync(
    path.join(proverDir, 'hash.json'),
    JSON.stringify(proverHash),
  );
}

/**
 * Check if a generated  zkProof is valid.
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
  testInput?: string;
  output?: string;
  help?: boolean;
};

/**
 * Main function to run.
 */
async function main() {
  // process command line arguments
  const args = parse<IProofGenPrepArguments>(
    {
      circuitName: {
        type: String,
        description: 'Name of the circuit to generate the proof for',
      },
      circuitsDir: {
        type: String,
        description: 'Path to the directory containing the wasm and zkey files',
        defaultValue: path.join(
          __dirname,
          '../../../zk-certificates/circuits/build',
        ),
      },
      testInput: {
        type: String,
        description: 'Path to the input file to use for testing',
        optional: true,
        defaultValue: undefined,
      },
      output: {
        type: String,
        optional: true,
        description:
          '(optional) Path to the output file to write the result to. Defaults to packages/galactica-dapp/public/provers/<name>.json',
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

  const testInput = args.testInput
    ? args.testInput
    : path.join(
        __dirname,
        `../../../zk-certificates/circuits/input/${args.circuitName}.json`,
      );

  if (!args.output) {
    args.output = `${__dirname}/../../../galactica-dapp/public/provers/${args.circuitName}.json`;
  }
  if (!fs.existsSync(testInput)) {
    throw new Error(`Test input file ${testInput} does not exist.`);
  }
  if (fs.lstatSync(testInput).isDirectory()) {
    throw new Error(`Test input ${testInput} must be a file, not a directory.`);
  }
  if (!fs.existsSync(args.circuitsDir)) {
    throw new Error(`Circuit dir ${args.circuitsDir} does not exist.`);
  }
  if (!fs.existsSync(path.dirname(args.output))) {
    throw new Error(`Target dir for ${args.output} does not exist.`);
  }

  console.warn(`Test ${testInput}`);
  const input = JSON.parse(fs.readFileSync(testInput).toString());

  // extract needed circuit data
  const params = await createCircuitData(
    args.circuitName,
    args.circuitsDir,
    input,
  );

  // await testStandard(input);
  await testModified(args.circuitName, args.circuitsDir, params);

  await writeCircuitDataToJSON(args.output, params.prover as ProverData);

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
