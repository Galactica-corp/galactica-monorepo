/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import camelcase from 'camelcase';
import download from 'download';
import fs from 'fs';
import { task, types } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { TASK_CIRCOM_TEMPLATE } from 'hardhat-circom';
import path from 'path';
import { zKey } from 'snarkjs';

import { postProcessSolidityVerifier } from './verifierPostProcessing';

/**
 * Script taking the trusted setup ceremony results from the p0tion server, saving it in the repo and rebuilding the solidity verifiers.
 *
 * @param args - Task arguments.
 * @param hre - Hardhat runtime environment.
 */
async function integrateCeremonyResults(
  args: any,
  hre: HardhatRuntimeEnvironment,
) {
  const downloadPrefix = `https://${args.ceremonyId}-ph2-galactica-2.s3.eu-central-1.amazonaws.com/circuits/`;

  // Get all the circuit names from the hardhat-circom config
  const { circuits } = hre.config.circom;

  const zkeyTargetFolder = path.join(
    __dirname,
    '..',
    'circuits',
    'build',
    'ceremony_zkeys',
  );
  const proverTargetFolder = path.join(__dirname, '..', 'circuits', 'build');
  const solTargetFolder = path.join(
    __dirname,
    '..',
    'contracts',
    'zkpVerifiers',
  );
  for (const folder of [
    zkeyTargetFolder,
    proverTargetFolder,
    solTargetFolder,
  ]) {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
  }

  let foundAnything = false;

  for (const circuit of circuits) {
    const circuitName = circuit.name;
    const circuitNameLower = circuitName.toLowerCase();
    const zkeyFileName = `${circuitNameLower}_final.zkey`;
    const zkeyUrl = `${downloadPrefix}${circuitNameLower}/contributions/${zkeyFileName}`;
    const wasmUrl = `${downloadPrefix}${circuitNameLower}/${circuitName}.wasm`;
    const r1csUrl = `${downloadPrefix}${circuitNameLower}/${circuitName}.r1cs`;
    const zkeyTargetPath = path.join(zkeyTargetFolder, zkeyFileName);

    try {
      // console.log(`Downloading ${zkeyUrl} ...`);
      await download(zkeyUrl, zkeyTargetFolder);
      // console.log(`Downloading ${wasmUrl}`);
      await download(wasmUrl, proverTargetFolder);
      // console.log(`Downloading ${r1csUrl}`);
      await download(r1csUrl, proverTargetFolder);
      foundAnything = true;
      console.log(`Found ceremony results for circuit ${circuitName}`);
    } catch {
      // console.warn(`Could not download zkey for circuit ${circuitName}: ${error}`);
      continue; // skip this circuit, apparently it is not included in the ceremony
    }

    // Copy the zkey file to the build folder so that tools, such as proofPrep, can use it
    fs.copyFileSync(
      zkeyTargetPath,
      path.join(proverTargetFolder, `${circuitName}.zkey`),
    );

    // Generate Solidity verifier using snarkjs
    const verifierName = camelcase(circuitName, {
      pascalCase: true,
      preserveConsecutiveUppercase: true,
      locale: false,
    });
    const solVerifierPath = path.join(
      solTargetFolder,
      `${verifierName}Verifier.sol`,
    );

    const zKeyFastFile = {
      type: 'mem',
      name: circuitName,
      data: fs.readFileSync(zkeyTargetPath),
    };

    try {
      console.log(`Generating Solidity verifier for ${circuitName} ...`);
      await hre.run(TASK_CIRCOM_TEMPLATE, { zkeys: [zKeyFastFile] });
      console.log(`Generated Solidity verifier at ${solVerifierPath}`);
    } catch (error) {
      console.error(`Failed to generate Solidity verifier for ${circuitName}`);
      throw error;
    }

    const vkeyJsonPath = path.join(
      proverTargetFolder,
      `${circuitName}.vkey.json`,
    );
    try {
      console.log(`Generating vkey.json for ${circuitName} ...`);
      const zKeyContent = await zKey.exportVerificationKey(zKeyFastFile);
      fs.writeFileSync(vkeyJsonPath, JSON.stringify(zKeyContent));
      console.log(`Generated ${vkeyJsonPath}`);
    } catch (error) {
      console.error(`Failed to generate vkey.json for ${circuitName}`);
      throw error;
    }

    // Post-processing on the verifier code (reuse logic from smartCircuitBuild)
    try {
      postProcessSolidityVerifier(solVerifierPath, verifierName);
      console.log(`Post-processed Solidity verifier at ${solVerifierPath}`);
    } catch (error) {
      console.error(`Failed post-processing for ${circuitName}`);
      throw error;
    }
  }

  if (!foundAnything) {
    console.error('No ceremony results found for ceremony id', args.ceremonyId);
    process.exit(1);
  }

  console.log('done');
}

// register task in hardhat
task(
  'integrateCeremonyResults',
  'Task integrating the ceremony results from the p0tion server',
)
  .addParam(
    'ceremonyId',
    'The id prefix of the finalized ceremony',
    undefined,
    types.string,
    false,
  )
  .setAction(async (taskArgs, hre) => {
    await integrateCeremonyResults(taskArgs, hre).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  });
