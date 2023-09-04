/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import fs from 'fs';
import path from "path";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import camelcase from "camelcase";


/**
 * @description Script (re)building circom circuits when needed
 */
async function smartCircuitBuild(
  // place for task arguments:
  {}: {},
  hre: HardhatRuntimeEnvironment) {
    console.log("Smart circuit build:");
    
    // Check that the trusted setup file exists
    if (!fs.existsSync(hre.config.circom.ptau)) {
      throw new Error(`Trusted setup file ${hre.config.circom.ptau} does not exist. Please have a look into the readme on how to get it.`);
    }

    // read the list of circuits from a config file    
    for (const circuit of hre.config.circom.circuits) {
      const rootPath = hre.config.paths.root;
      
      const verifierName = camelcase(circuit.name, {
        pascalCase: true,
        preserveConsecutiveUppercase: true,
        locale: false,
      });
      const verifierPath = path.join(rootPath, "contracts", verifierName + "Verifier.sol");
      const buildConfigPath = path.join(hre.config.circom.outputBasePath, circuit.name + "BuildConfig.json");
      
      const outputFiles = [
        verifierPath,
        buildConfigPath,
        path.join(circuit.wasm ? circuit.wasm : circuit.name + ".wasm"),
        path.join(circuit.zkey ? circuit.zkey : circuit.name + ".zkey"),
      ];
      
      const sourceFiles = findAllImportedSourceFiles(circuit.circuit, []);
      // recompile also needed if a new ptau file is used
      sourceFiles.push(hre.config.circom.ptau);
      
      // check build file existance
      let buildNeeded = false;
      for (const outputFile of outputFiles) {
        if (!fs.existsSync(outputFile)) {
          buildNeeded = true;
          console.log(`Rebuilding ${circuit.name} because ${outputFile} does not exist`);
          break;
        }
      }
      if (!buildNeeded){
        // check if source files changed
        let oldestOutputModificationTime = Number.MAX_SAFE_INTEGER;
        for (const file of outputFiles) {
          const modificationTime = fs.statSync(file).mtimeMs;
          if (modificationTime < oldestOutputModificationTime) {
            oldestOutputModificationTime = modificationTime;
          }
        }
        let latestSourseModificationTime = 0;
        for (const file of sourceFiles) {
          const modificationTime = fs.statSync(file).mtimeMs;
          if (modificationTime > latestSourseModificationTime) {
            latestSourseModificationTime = modificationTime;
          }
        }

        if (latestSourseModificationTime > oldestOutputModificationTime) {
          buildNeeded = true;
          console.log(`Rebuilding ${circuit.name} because source files changed`);
        }
      }
      if(!buildNeeded) {
        // check if build config changed
        // file should be present because otherwise buildNeeded would be true already
        const previousConfig = JSON.parse(fs.readFileSync(buildConfigPath, 'utf8'));
        
        if (JSON.stringify(previousConfig) !== JSON.stringify(circuit)) {
          // this would also triger on different order of keys
          buildNeeded = true;
          console.log(`Rebuilding ${circuit.name} because build config changed`);
        }
      }

      if (!buildNeeded) {
        console.log(`${circuit.name} is up to date`);
      } else {
        console.log(`Compiling circuit ${circuit.name}. This might take a while...`);
        await hre.run("circom", {circuit: circuit.name})

        const contentBefore = fs.readFileSync(verifierPath, 'utf8');
        var contentAfter = contentBefore.
          // Make contract names unique so that hardhat does not complain
          replace(/contract Verifier {/g, `contract ${verifierName}Verifier {`).
          // Allow dynamic length array as input (including spaces to only replace the instance in the verifier function)
          replace(/            uint\[[0-9]*\] memory input/g, `            uint[] memory input`);

        fs.writeFileSync(verifierPath, contentAfter, 'utf8');

        // Write JSON of build config for that circuit to detect changes
        fs.writeFileSync(buildConfigPath, JSON.stringify(circuit, null, 2), 'utf8');
      }
    }

    console.log("done");
}
  
// register task in hardhat
task("smartCircuitBuild", "Task (re)building circom circuits when source files changed")
  .setAction(async (taskArgs, hre) => {
    await smartCircuitBuild(taskArgs, hre).catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
  });
 
/**
 * @description Helper function to recursively find all imported files
 */
function findAllImportedSourceFiles(rootCircuit: string, visited: string[]) : string[] {
  let res = [rootCircuit];
  visited.push(rootCircuit);

  const fileContent = fs.readFileSync(rootCircuit, 'utf-8');

  for (const line of fileContent.split('\n')) {
    if (line.startsWith("include")) {
      const includedFile = line.split('"')[1];
      const includedFilePath = path.join(path.dirname(rootCircuit), includedFile);
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
