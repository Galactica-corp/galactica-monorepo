import { poseidonContract } from 'circomlibjs';
import hre from 'hardhat';

import { overwriteArtifact } from '../lib/helpers';

/**
 * Script to prepare the Poseidon artifact for Ignition deployment.
 * This must be run before deploying any modules that use PoseidonT3.
 */
async function main() {
  console.log('Preparing Poseidon artifact...');
  
  // Overwrite the PoseidonT3 artifact with the circomlibjs generated code
  await overwriteArtifact(hre, 'PoseidonT3', poseidonContract.createCode(2));
  
  console.log('Poseidon artifact prepared successfully!');
}

main().catch((error) => {
  console.error('Error preparing Poseidon artifact:', error);
  process.exitCode = 1;
});