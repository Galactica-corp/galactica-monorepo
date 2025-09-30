import { task, types } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Contract } from 'ethers';
import fs from 'fs';
import path from 'path';
import csv from 'csvtojson';
import { decodeHolders, removeEmptyColumns } from '../lib/csvUtils';
import { GalacticaOfficialSBT__factory, ClaimrSignedSBT__factory } from '../typechain-types';
import chalk from 'chalk';

type Row = {
  name: string;
  'reticulum contract': string;
  'issuance will continue after mainnet?': string;
  'detected type': string;
  'name(chain)': string;
  'symbol(chain)': string;
  'baseURI/tokenURI': string;
  'holdersCount': string;
  'holders': string;
  'mainnet contract'?: string;
  'done'?: string;
  [key: string]: string | undefined;
};

/**
 * Helper to try verifying a contract and log an error if it fails. If it fails, it will also log the command to run verification later.
 *
 * @param address - Address of the contract.
 * @param constructorArguments - Constructor arguments used for deployment.
 * @param contract - Fully qualified name of the contract (e.g. "contracts/SBT_related/VerificationSBT.sol:VerificationSBT").
 */
async function tryVerification(
  hre: HardhatRuntimeEnvironment,
  address: string,
  constructorArguments: any[],
  contract: string,
) {
  try {
    await hre.run('verify:verify', {
      address,
      constructorArguments,
      contract,
    });
  } catch (error: any) {
    console.error(chalk.red(`Verification failed: ${error.message as string}`));
    console.error(
      chalk.red(
        `Sometimes the block explorer is slow to update. Try again in a few minutes.`,
      ),
    );
    console.log(`Command to run verification later:`);
    console.log(
      chalk.yellow(
        `yarn hardhat verify --contract "${contract}" ${address} "${constructorArguments.join(
          '" "',
        )}" --network [NETWORK] `,
      ),
    );
  }
}

function toCsvLine(fields: (string | number)[]): string {
  return fields
    .map((f) => {
      const s = String(f ?? '');
      if (/[",\n]/.test(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    })
    .join(',');
}

async function deployGalacticaOfficialSBT(
  hre: HardhatRuntimeEnvironment,
  name: string,
  symbol: string,
  baseURI: string,
  deployer: string,
  verify: boolean = true
): Promise<string> {
  console.log(`Deploying GalacticaOfficialSBT: ${name} (${symbol})`);

  const [signer] = await hre.ethers.getSigners();
  const factory = new GalacticaOfficialSBT__factory(signer);
  const contract = await factory.deploy(
    deployer, // issuer
    baseURI,  // uri
    deployer, // owner
    name,     // nftName
    symbol    // nftSymbol
  );

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`Deployed GalacticaOfficialSBT at: ${address}`);

  // Verify the contract if requested
  if (verify) {
    console.log(`Verifying GalacticaOfficialSBT at ${address}...`);
    const constructorArgs = [deployer, baseURI, deployer, name, symbol];
    await tryVerification(
      hre,
      address,
      constructorArgs,
      'contracts/SBT_related/GalacticaOfficialSBT.sol:GalacticaOfficialSBT'
    );
  }

  return address;
}

async function deployClaimrSBT(
  hre: HardhatRuntimeEnvironment,
  name: string,
  symbol: string,
  baseURI: string,
  deployer: string,
  verify: boolean = true
): Promise<string> {
  console.log(`Deploying ClaimrSBT: ${name} (${symbol})`);

  const [signer] = await hre.ethers.getSigners();
  const factory = new ClaimrSignedSBT__factory(signer);
  const contract = await factory.deploy(
    name,     // name
    symbol,   // symbol
    baseURI,  // baseTokenURI
    deployer  // signee
  );

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`Deployed ClaimrSBT at: ${address}`);

  // Verify the contract if requested
  if (verify) {
    console.log(`Verifying ClaimrSBT at ${address}...`);
    const constructorArgs = [name, symbol, baseURI, deployer];
    await tryVerification(
      hre,
      address,
      constructorArgs,
      'contracts/ClaimrSBT.sol:claimrSignedSBT'
    );
  }

  return address;
}

async function batchMintGalacticaOfficialSBT(
  hre: HardhatRuntimeEnvironment,
  contractAddress: string,
  holders: string[]
): Promise<void> {
  console.log(`Batch minting ${holders.length} tokens for GalacticaOfficialSBT`);

  const [signer] = await hre.ethers.getSigners();
  const contract = new Contract(contractAddress, GalacticaOfficialSBT__factory.abi, signer);

  // Mint in batches to avoid gas limit issues
  const batchSize = 50; // Adjust based on gas limits
  for (let i = 0; i < holders.length; i += batchSize) {
    const batch = holders.slice(i, i + batchSize);
    console.log(`Minting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(holders.length / batchSize)} (${batch.length} tokens)`);

    const tx = await contract.batchMint(batch);
    await tx.wait();
  }

  console.log(`Successfully minted ${holders.length} tokens`);
}

task('sbt:migration:transfer', 'Deploy SBTs to mainnet and mint for holders')
  .addParam('input', 'Path to input CSV with gathered data', 'packages/zk-certificates/data/sbtMigrationOut.csv', types.string)
  .addOptionalParam('output', 'Path to output CSV (defaults to overwrite input)', '', types.string)
  .addOptionalParam('limit', 'Limit number of rows to process', 1, types.int)
  .addOptionalParam('verify', 'Verify contracts on block explorer', true, types.boolean)
  .setAction(async (args, hre) => {
    const inputPath = path.resolve(args.input);
    const outputPath = path.resolve(args.output || args.input);

    let inputCsv = fs.readFileSync(inputPath, 'utf8');
    // Normalize: drop any leading rows until we reach the header that contains required columns
    const lines = inputCsv.split(/\r?\n/);
    const headerIdx = lines.findIndex((l) => /(^|,)name(,|$)/i.test(l) && /(^|,)reticulum contract(,|$)/i.test(l));
    if (headerIdx > 0) {
      inputCsv = lines.slice(headerIdx).join('\n');
    }
    const rows = (await csv({ noheader: false, trim: true }).fromString(inputCsv)) as Row[];

    // Get deployer address
    const [deployer] = await hre.ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    console.log(`Deployer address: ${deployerAddress}`);

    // Prepare header for enriched CSV
    const appendHeader = [
      'mainnet contract',
      'done',
    ];

    const limit = Number(args.limit ?? 0) > 0 ? Number(args.limit) : rows.length;

    const originalLines = fs.readFileSync(inputPath, 'utf8').split(/\r?\n/);
    const headerIdx2 = originalLines.findIndex((l) => /(^|,)name(,|$)/i.test(l) && /(^|,)reticulum contract(,|$)/i.test(l));
    const outLines: string[] = [];
    if (headerIdx2 > 0) {
      // Preserve preamble
      outLines.push(...originalLines.slice(0, headerIdx2));
    }
    const baseHeader = headerIdx2 >= 0 ? originalLines[headerIdx2] : 'name,reticulum contract,issuance will continue after mainnet?,detected type,name(chain),symbol(chain),baseURI/tokenURI,holdersCount,holders';
    outLines.push(baseHeader + ',' + appendHeader.join(','));

    let processed = 0;
    const dataStart = headerIdx2 >= 0 ? headerIdx2 + 1 : 1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const originalRowLine = originalLines[dataStart + i] ?? toCsvLine([
        row.name ?? '',
        row['reticulum contract'] ?? '',
        row['issuance will continue after mainnet?'] ?? '',
        row['detected type'] ?? '',
        row['name(chain)'] ?? '',
        row['symbol(chain)'] ?? '',
        row['baseURI/tokenURI'] ?? '',
        row['holdersCount'] ?? '',
        row['holders'] ?? ''
      ]);

      if (!row.name || !row['reticulum contract']) {
        outLines.push(originalRowLine + ',' + ','.repeat(appendHeader.length - 1));
        continue;
      }

      if (processed >= limit) {
        outLines.push(originalRowLine + ',' + ','.repeat(appendHeader.length - 1));
        continue;
      }

      // Skip if already done
      if (row.done === 'true') {
        console.log(`Skipping ${row.name} - already completed`);
        outLines.push(originalRowLine + ',' + toCsvLine([row['mainnet contract'] || '', 'true']));
        continue;
      }

      // Skip if issuance will continue after mainnet
      if (row['issuance will continue after mainnet?']?.toLowerCase() === 'yes') {
        console.log(`Skipping ${row.name} - issuance will continue after mainnet`);
        outLines.push(originalRowLine + ',' + toCsvLine(['', 'skipped - issuance continues']));
        continue;
      }

      try {
        const name = row['name(chain)'] || row.name;
        const symbol = row['symbol(chain)'] || 'SBT';
        const baseURI = row['baseURI/tokenURI'] || '';
        const holders = decodeHolders(row['holders'] || '');
        const contractType = row['detected type'];

        console.log(`\nProcessing ${row.name}:`);
        console.log(`  Type: ${contractType}`);
        console.log(`  Name: ${name}`);
        console.log(`  Symbol: ${symbol}`);
        console.log(`  Holders: ${holders.length}`);

        let mainnetAddress = '';

        if (contractType === 'GalacticaOfficialSBT') {
          // Deploy GalacticaOfficialSBT
          mainnetAddress = await deployGalacticaOfficialSBT(hre, name, symbol, baseURI, deployerAddress, args.verify);

          // Batch mint for all holders
          if (holders.length > 0) {
            await batchMintGalacticaOfficialSBT(hre, mainnetAddress, holders);
          }

        } else if (contractType === 'ClaimrSBT') {
          // Deploy ClaimrSBT
          mainnetAddress = await deployClaimrSBT(hre, name, symbol, baseURI, deployerAddress, args.verify);

          // Note: ClaimrSBT batch minting not implemented yet
          console.log('Note: ClaimrSBT batch minting not implemented yet. Manual minting required.');

        } else {
          throw new Error(`Unknown contract type: ${contractType}`);
        }

        outLines.push(originalRowLine + ',' + toCsvLine([mainnetAddress, 'true']));
        console.log(`✅ Successfully migrated ${row.name} to ${mainnetAddress}`);

      } catch (err) {
        console.error(`❌ Failed to migrate ${row.name}:`, err);
        outLines.push(originalRowLine + ',' + toCsvLine(['', 'error: ' + (err as Error).message]));
      }

      processed += 1;
    }

    // Preserve trailing lines beyond parsed rows, if any
    const remainingStart = dataStart + rows.length;
    for (let li = remainingStart; li < originalLines.length; li++) {
      const line = originalLines[li];
      if (line.trim().length === 0) continue;
      outLines.push(line + ',' + ','.repeat(appendHeader.length - 1));
    }

    // Remove empty columns from the output
    const cleanedLines = removeEmptyColumns(outLines);

    fs.writeFileSync(outputPath, cleanedLines.join('\n') + (cleanedLines[cleanedLines.length - 1]?.endsWith('\n') ? '' : '\n'), 'utf8');
    console.log(`\nWrote updated CSV to ${outputPath}`);
  });
