/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import camelcase from 'camelcase';
import cryptoLib from 'crypto';
import fs from 'fs';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import path from 'path';

/**
 * Script (re)building circom circuits when needed.
 *
 * @param args - Task arguments.
 * @param hre - Hardhat runtime environment.
 */
async function smartCircuitBuild(
  // place for task arguments ignored because not needed yet
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  args: any,
  hre: HardhatRuntimeEnvironment,
) {
  console.log('Smart circuit build:');

  // Check that the trusted setup file exists
  if (!fs.existsSync(hre.config.circom.ptau)) {
    throw new Error(
      `Trusted setup file ${hre.config.circom.ptau} does not exist. Please have a look into the readme on how to get it.`,
    );
  }

  // read the list of circuits from a config file
  for (const circuit of hre.config.circom.circuits) {
    const rootPath = hre.config.paths.root;

    const verifierName = camelcase(circuit.name, {
      pascalCase: true,
      preserveConsecutiveUppercase: true,
      locale: false,
    });
    const verifierPath = path.join(
      rootPath,
      'contracts/zkpVerifiers',
      `${verifierName}Verifier.sol`,
    );
    const buildConfigPath = path.join(
      hre.config.circom.outputBasePath,
      `${circuit.name}BuildConfig.json`,
    );

    const outputFiles = [
      verifierPath,
      buildConfigPath,
      path.join(circuit.wasm ? circuit.wasm : `${circuit.name}.wasm`),
      path.join(circuit.zkey ? circuit.zkey : `${circuit.name}.zkey`),
    ];

    const sourceFiles = findAllImportedSourceFiles(circuit.circuit, []);
    // recompile also needed if a new ptau file is used
    outputFiles.push(hre.config.circom.ptau);

    // check build file existence
    let buildNeeded = false;
    for (const outputFile of outputFiles) {
      if (!fs.existsSync(outputFile)) {
        buildNeeded = true;
        console.log(
          `Rebuilding ${circuit.name} because ${outputFile} does not exist`,
        );
        break;
      }
    }

    // check content hash of source files
    const sourceHashes: Record<string, string> = {};
    for (const file of sourceFiles) {
      const fileBuffer = fs.readFileSync(file, 'utf8');
      const hashSum = cryptoLib.createHash('sha256');
      hashSum.update(fileBuffer);
      sourceHashes[file] = hashSum.digest('hex');
    }

    if (!buildNeeded) {
      // compare with hashes from last build saved in buildConfig
      const previousConfig = JSON.parse(
        fs.readFileSync(buildConfigPath, 'utf8'),
      );
      if (previousConfig.sourceHashes) {
        for (const file of sourceFiles) {
          if (previousConfig.sourceHashes[file] !== sourceHashes[file]) {
            buildNeeded = true;
            console.log(
              `Rebuilding ${circuit.name} because ${file} changed since last build`,
            );
            break;
          }
        }
      } else {
        buildNeeded = true;
        console.log(
          `Rebuilding ${circuit.name} because build config does not contain source hashes`,
        );
      }
    }
    if (!buildNeeded) {
      // check if build config changed
      // file should be present because otherwise buildNeeded would be true already
      const previousConfig = JSON.parse(
        fs.readFileSync(buildConfigPath, 'utf8'),
      );

      if (JSON.stringify(previousConfig.circuit) !== JSON.stringify(circuit)) {
        // this would also trigger on different order of keys
        buildNeeded = true;
        console.log(`Rebuilding ${circuit.name} because build config changed`);
      }
    }

    if (buildNeeded) {
      console.log(
        `Compiling circuit ${circuit.name}. This might take a while...`,
      );
      await hre.run('circom', { circuit: circuit.name });

      const contentBefore = fs.readFileSync(verifierPath, 'utf8');
      const contentAfter = contentBefore
        // Make contract names unique so that hardhat does not complain
        .replace(/contract Verifier \{/gu, `contract ${verifierName}Verifier {`)
        // Allow dynamic length array as input (including spaces to only replace the instance in the verifier function)
        .replace(
          / {12}uint\[[0-9]*\] memory input/gu,
          `            uint[] memory input`,
        );

      fs.writeFileSync(verifierPath, contentAfter, 'utf8');

      // Write JSON of build config for that circuit to detect changes
      const buildConfig = {
        circuit,
        sourceHashes,
      };
      fs.writeFileSync(
        buildConfigPath,
        JSON.stringify(buildConfig, null, 2),
        'utf8',
      );
    } else {
      console.log(`${circuit.name} is up to date`);
    }
  }

  console.log('done');
}

// register task in hardhat
task(
  'smartCircuitBuild',
  'Task (re)building circom circuits when source files changed',
).setAction(async (taskArgs, hre) => {
  await smartCircuitBuild(taskArgs, hre).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
});

/**
 * Helper function to recursively find all imported files.
 *
 * @param rootCircuit - Circuit file to start with.
 * @param visited - List of already visited files.
 * @returns List of all imported files.
 */
function findAllImportedSourceFiles(
  rootCircuit: string,
  visited: string[],
): string[] {
  const res = [rootCircuit];
  visited.push(rootCircuit);

  const fileContent = fs.readFileSync(rootCircuit, 'utf-8');

  for (const line of fileContent.split('\n')) {
    if (line.startsWith('include')) {
      const includedFile = line.split('"')[1];
      const includedFilePath = path.join(
        path.dirname(rootCircuit),
        includedFile,
      );
      if (visited.includes(includedFilePath)) {
        continue;
      }
      const newImports = findAllImportedSourceFiles(includedFilePath, visited);
      res.push(...newImports);
      visited.push(...newImports);
    }
  }

  return res;
}
