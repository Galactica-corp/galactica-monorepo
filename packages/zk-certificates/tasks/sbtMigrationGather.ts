import { task, types } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Contract, Interface, ZeroAddress, keccak256, toUtf8Bytes, zeroPadValue } from 'ethers';
import fs from 'fs';
import path from 'path';
import csv from 'csvtojson';
import { printProgress } from '../lib/helpers';
import { encodeHolders, removeEmptyColumns } from '../lib/csvUtils';
import { AccessControl__factory, ERC721__factory, VerificationSBT, ZkCertificateRegistry } from '../typechain-types';

// Block explorer API response types
interface BlockExplorerLog {
  address: string;
  blockNumber: string;
  data: string;
  gasPrice: string;
  gasUsed: string;
  logIndex: string;
  timeStamp: string;
  topics: string[];
  transactionHash: string;
  transactionIndex: string;
}

interface BlockExplorerResponse {
  message: string;
  result: BlockExplorerLog[];
  status: string;
}

// Function to fetch logs from block explorer API
async function fetchLogsFromBlockExplorer(
  address: string,
  fromBlock: number,
  toBlock: number,
  maxRetries: number = 5
): Promise<BlockExplorerLog[]> {
  const baseUrl = 'https://explorer-reticulum.galactica.com/api';
  const params = new URLSearchParams({
    module: 'logs',
    action: 'getLogs',
    fromBlock: fromBlock.toString(),
    toBlock: toBlock.toString(),
    address: address,
  });

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`${baseUrl}?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: BlockExplorerResponse = await response.json();

      if (data.status === '1' && data.message === 'OK') {
        return data.result;
      } else if (data.message === 'No logs found') {
        // "No logs found" is not an error, just return empty array
        return [];
      } else {
        throw new Error(`API error: ${data.message}`);
      }
    } catch (error) {
      console.error(`Error fetching logs from block explorer (attempt ${attempt + 1}/${maxRetries}):`, error);
      if (attempt === maxRetries - 1) {
        throw error;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  return [];
}

type Row = {
  name: string;
  'reticulum contract': string;
  'issuance will continue after mainnet?': string;
  [key: string]: string;
};

const ACCESS_CONTROL_ABI = AccessControl__factory.abi;

const ISSUER_ROLE = keccak256(toUtf8Bytes('ISSUER_ROLE'));

async function detectContractType(hre: HardhatRuntimeEnvironment, address: string): Promise<'GalacticaOfficialSBT' | 'ClaimrSBT' | 'Unknown'> {
  const provider = hre.ethers.provider;
  const ac = new Contract(address, ACCESS_CONTROL_ABI, provider);
  try {
    // Probe hasRole; if it reverts/function not found, it's not AccessControl.
    // Call with zero address just to check existence.
    await ac.hasRole.staticCall(ISSUER_ROLE, ZeroAddress);
    return 'GalacticaOfficialSBT';
  } catch {
    // Fallback to Claimr assumption.
    return 'ClaimrSBT';
  }
}

async function gatherForAddress(hre: HardhatRuntimeEnvironment, address: string, maxBlockInterval: number = 10000) {
  const provider = hre.ethers.provider;
  const erc721 = new Contract(address, ERC721__factory.abi, provider);
  const name: string = await erc721.name();
  const symbol: string = await erc721.symbol();
  let anyId = 0n;
  let tokenURI = '';

  const contractType = await detectContractType(hre, address);

  // holders: Transfer(from==0x0)
  const iface = new Interface(ERC721__factory.abi);
  const topic = iface.getEvent('Transfer')?.topicHash;
  if (!topic) {
    throw new Error('Transfer event not found');
  }
  const currentBlock = await provider.getBlockNumber();
  const firstBlock = 1;
  const holders = new Set<string>();
  let countBurntSBTs = 0;
  let countDuplicateSBTs = 0;

  // get logs in batches because of API call size limit
  let currentStartBlock = firstBlock;

  while (currentStartBlock < currentBlock) {
    const maxBlock = Math.min(currentStartBlock + maxBlockInterval, currentBlock);

    // show progress
    const progress = Math.round(((currentStartBlock - firstBlock) / (currentBlock - firstBlock)) * 100);
    printProgress(`Scanning blocks ${currentStartBlock}-${maxBlock} (${progress}%)`);

    let logs: BlockExplorerLog[] = [];
    try {
      logs = await fetchLogsFromBlockExplorer(address, currentStartBlock, maxBlock);
    } catch (error) {
      console.error(`Error getting logs from ${currentStartBlock} to ${maxBlock}:`, error);
      currentStartBlock = maxBlock + 1;
      continue;
    }

    if (logs && logs.length > 0) {
      for (const log of logs) {
        try {
          // Convert block explorer log format to ethers log format
          const ethersLog = {
            address: log.address,
            blockNumber: parseInt(log.blockNumber, 16),
            data: log.data,
            logIndex: parseInt(log.logIndex, 16),
            topics: log.topics,
            transactionHash: log.transactionHash,
            transactionIndex: parseInt(log.transactionIndex, 16),
          };

          if (ethersLog.topics[0] !== topic) {
            // skip if not a transfer log
            continue;
          }

          const parsed = iface.parseLog(ethersLog);
          const to = (parsed?.args?.to as string);
          const from = (parsed?.args?.from as string);

          // Log when zero address is found as a holder (burn event)
          if (to === ZeroAddress) {
            // remove holder from the set
            holders.delete(from);
            countBurntSBTs++;
          }
          else {
            if (holders.has(to)) {
              countDuplicateSBTs++;
            }
            holders.add(to);
            anyId = parsed?.args?.tokenId as bigint;
          }
        } catch (error) {
          console.error(`Error parsing log:`, error);
        }
        if (tokenURI === '') {
          try {
            tokenURI = await erc721.tokenURI(anyId);
          } catch (error) {
            console.error(`Error getting tokenURI:`, error);
          }
        }
      }

      // Check if we got exactly 1000 events, which might indicate truncation
      if (logs.length === 1000) {
        // Find the highest block number in the response
        const lastBlockNumber = Math.max(...logs.map(log => parseInt(log.blockNumber, 16)));

        // If the last block in our range is higher than the last event's block,
        // there might be more events. Continue from the next block.
        if (lastBlockNumber < maxBlock) {
          console.log(`Detected potential truncation at block ${lastBlockNumber}, continuing from block ${lastBlockNumber + 1}`);
          currentStartBlock = lastBlockNumber + 1;
          continue;
        }
      }
    }

    // Move to the next block range
    currentStartBlock = maxBlock + 1;
  }

  // clear progress line
  printProgress('100');
  console.log();
  console.log(`Found ${holders.size} holders for ${address}`);
  console.log(`countBurntSBTs: ${countBurntSBTs}`);
  console.log(`countDuplicateSBTs: ${countDuplicateSBTs}`);
  console.log();

  console.log(`got tokenURI: ${tokenURI}`);

  return {
    name,
    symbol,
    tokenURI: tokenURI ?? '',
    contractType,
    holders: Array.from(holders),
    holdersCount: holders.size,
  };
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


task('sbt:migration:gather', 'Gather SBT metadata and holders and update CSV')
  .addParam('input', 'Path to input CSV', 'packages/zk-certificates/data/sbtMigration.csv', types.string)
  .addOptionalParam('output', 'Path to output CSV (defaults to overwrite input)', '', types.string)
  .addOptionalParam('limit', 'Limit number of rows to process', 2, types.int)
  .addOptionalParam('maxBlockInterval', 'Maximum block distance for RPC calls', 9082685, types.int)
  .setAction(async (args, hre) => {
    const inputPath = path.resolve(args.input);
    const outputPath = path.resolve(args.output || args.input);

    let inputCsv = fs.readFileSync(inputPath, 'utf8');
    // Normalize: drop any leading rows until we reach the header that contains required columns
    // This handles inputs whose first row is only commas.
    const lines = inputCsv.split(/\r?\n/);
    const headerIdx = lines.findIndex((l) => /(^|,)name(,|$)/i.test(l) && /(^|,)reticulum contract(,|$)/i.test(l));
    if (headerIdx > 0) {
      inputCsv = lines.slice(headerIdx).join('\n');
    }
    const rows = (await csv({ noheader: false, trim: true }).fromString(inputCsv)) as Row[];

    // prepare header for enriched CSV
    const appendHeader = [
      'detected type',
      'name(chain)',
      'symbol(chain)',
      'baseURI/tokenURI',
      'holdersCount',
      'holders',
    ];

    const limit = Number(args.limit ?? 0) > 0 ? Number(args.limit) : rows.length;

    const originalLines = fs.readFileSync(inputPath, 'utf8').split(/\r?\n/);
    const headerIdx2 = originalLines.findIndex((l) => /(^|,)name(,|$)/i.test(l) && /(^|,)reticulum contract(,|$)/i.test(l));
    const outLines: string[] = [];
    if (headerIdx2 > 0) {
      // Preserve preamble
      outLines.push(...originalLines.slice(0, headerIdx2));
    }
    const baseHeader = headerIdx2 >= 0 ? originalLines[headerIdx2] : 'name,reticulum contract,issuance will continue after mainnet?';
    outLines.push(baseHeader + ',' + appendHeader.join(','));

    let processed = 0;
    const dataStart = headerIdx2 >= 0 ? headerIdx2 + 1 : 1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const originalRowLine = originalLines[dataStart + i] ?? toCsvLine([row.name ?? '', row['reticulum contract'] ?? '', row['issuance will continue after mainnet?'] ?? '']);
      if (!row.name || !row['reticulum contract']) {
        outLines.push(originalRowLine + ',' + ','.repeat(appendHeader.length - 1));
        continue;
      }
      if (processed >= limit) {
        outLines.push(originalRowLine + ',' + ','.repeat(appendHeader.length - 1));
        continue;
      }
      const address = row['reticulum contract'];
      try {
        const info = await gatherForAddress(hre, address, args.maxBlockInterval);
        outLines.push(
          originalRowLine +
          ',' +
          toCsvLine([
            info.contractType,
            info.name,
            info.symbol,
            info.tokenURI,
            info.holdersCount,
            encodeHolders(info.holders),
          ])
        );
      } catch (err) {
        console.error(`Failed to gather for ${row.name} @ ${address}:`, err);
        outLines.push(originalRowLine + ',' + toCsvLine(['Error', '', '', '', 0, encodeHolders([])]));
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
    console.log(`Wrote enriched CSV to ${outputPath}`);
  });


