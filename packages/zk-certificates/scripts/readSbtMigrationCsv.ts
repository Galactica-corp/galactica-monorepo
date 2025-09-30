#!/usr/bin/env ts-node

import fs from 'fs';
import csv from 'csvtojson';
import { decodeHolders, removeEmptyColumns } from '../lib/csvUtils';

interface SbtMigrationRow {
  name: string;
  'reticulum contract': string;
  'issuance will continue after mainnet?': string;
  'detected type': string;
  'name(chain)': string;
  'symbol(chain)': string;
  'baseURI/tokenURI': string;
  'holdersCount': string;
  'holders': string; // This is base64 encoded
}

async function readSbtMigrationCsv(csvPath: string) {
  console.log(`Reading SBT migration CSV from: ${csvPath}`);

  const csvContent = fs.readFileSync(csvPath, 'utf8');

  // First, let's clean the CSV by removing empty columns
  const lines = csvContent.split(/\r?\n/);
  const cleanedLines = removeEmptyColumns(lines);
  const cleanedCsv = cleanedLines.join('\n');

  console.log('Original CSV structure:');
  console.log(lines.slice(0, 3).join('\n'));
  console.log('\nCleaned CSV structure:');
  console.log(cleanedLines.slice(0, 3).join('\n'));
  console.log();

  const rows = await csv({ noheader: false, trim: true }).fromString(cleanedCsv) as SbtMigrationRow[];

  console.log(`Found ${rows.length} SBT entries`);
  console.log();

  for (const row of rows) {
    if (!row.name || row.name === 'name') continue; // Skip header and empty rows

    console.log(`SBT: ${row.name}`);
    console.log(`  Contract: ${row['reticulum contract']}`);
    console.log(`  Type: ${row['detected type'] || 'N/A'}`);
    console.log(`  Chain Name: ${row['name(chain)'] || 'N/A'}`);
    console.log(`  Symbol: ${row['symbol(chain)'] || 'N/A'}`);
    console.log(`  Token URI: ${row['baseURI/tokenURI'] || 'N/A'}`);
    console.log(`  Holders Count: ${row['holdersCount'] || '0'}`);

    // Decode the holders list
    if (row['holders']) {
      const holders = decodeHolders(row['holders']);
      console.log(`  Holders: ${holders.length > 0 ? holders.join(', ') : 'None'}`);
    } else {
      console.log(`  Holders: None`);
    }
    console.log();
  }
}

// Example usage
if (require.main === module) {
  const csvPath = process.argv[2] || 'packages/zk-certificates/data/sbtMigrationOut.csv';
  readSbtMigrationCsv(csvPath).catch(console.error);
}

export { readSbtMigrationCsv, decodeHolders };
