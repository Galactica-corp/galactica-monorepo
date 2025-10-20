import { buildPoseidon } from 'circomlibjs';
import { writeFileSync } from 'fs';
import { join } from 'path';

import { hashStringToFieldNumber } from '../lib/helpers';

/**
 * Script to generate the sanction list parameter file for Ignition modules.
 * This calculates Poseidon hashes for country codes and writes them to the parameter file.
 */
async function main() {
  console.log('Generating sanction list parameter file...');

  const poseidon = await buildPoseidon();

  const countries = [
    'USA',
    'RUS',
    'BLR',
    'IRN',
    'PRK',
    'SYR',
    'VEN',
    'CUB',
    'MMR',
    'LBY',
    'SDN',
    'SSD',
    'YEM',
    'SOM',
    'COD',
    'CAF',
  ];

  console.log('Calculating Poseidon hashes for country codes...');

  const countryHashes: Record<string, string> = {};
  for (const country of countries) {
    const hash = hashStringToFieldNumber(country, poseidon);
    countryHashes[country] = hash;
    console.log(`${country}: ${hash}`);
  }

  const jsonOutput = {
    sanctionedCountries: countryHashes,
  };

  // Write to the parameter file
  const outputPath = join(__dirname, '../ignition/params/sanction_list.json');
  writeFileSync(outputPath, JSON.stringify(jsonOutput, null, 2));

  console.log(`\nSanction list written to: ${outputPath}`);
  console.log(`Generated hashes for ${countries.length} countries.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
