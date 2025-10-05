import { task, types } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Contract, Interface, ZeroAddress } from 'ethers';
import fs from 'fs';
import path from 'path';
import { ERC721__factory } from '../typechain-types';
import { printProgress } from '../lib/helpers';

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

// Function to get all Transfer logs for an NFT contract
async function getAllTransferLogs(
  hre: HardhatRuntimeEnvironment,
  nftAddress: string,
  toBlock: number,
  maxBlockInterval: number = 100000
): Promise<BlockExplorerLog[]> {
  const provider = hre.ethers.provider;
  const iface = new Interface(ERC721__factory.abi);
  const transferTopic = iface.getEvent('Transfer')?.topicHash;

  if (!transferTopic) {
    throw new Error('Transfer event not found');
  }

  const allLogs: BlockExplorerLog[] = [];
  const firstBlock = 1;

  // Get logs in batches to handle API limits
  let currentStartBlock = firstBlock;

  while (currentStartBlock <= toBlock) {
    const maxBlock = Math.min(currentStartBlock + maxBlockInterval - 1, toBlock);

    // Show progress
    const progress = Math.round(((currentStartBlock - firstBlock) / (toBlock - firstBlock)) * 100);
    printProgress(`Scanning blocks ${currentStartBlock}-${maxBlock} for ${nftAddress} (${progress}%)`);

    let logs: BlockExplorerLog[] = [];
    try {
      logs = await fetchLogsFromBlockExplorer(nftAddress, currentStartBlock, maxBlock);
    } catch (error) {
      console.error(`Error getting logs from ${currentStartBlock} to ${maxBlock}:`, error);
      currentStartBlock = maxBlock + 1;
      continue;
    }

    // Filter for Transfer events
    const transferLogs = logs.filter(log => log.topics[0] === transferTopic);
    allLogs.push(...transferLogs);

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

    // Move to the next block range
    currentStartBlock = maxBlock + 1;
  }

  return allLogs;
}

// Function to process Transfer logs and calculate balances
function processTransferLogs(
  logs: BlockExplorerLog[],
  nftAddress: string
): Record<string, number> {
  const iface = new Interface(ERC721__factory.abi);
  const balances: Record<string, number> = {};

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

      const parsed = iface.parseLog(ethersLog);
      if (!parsed) continue;

      const from = parsed.args?.from as string;
      const to = parsed.args?.to as string;

      // Initialize balances if not present
      if (from !== ZeroAddress && !balances[from]) {
        balances[from] = 0;
      }
      if (to !== ZeroAddress && !balances[to]) {
        balances[to] = 0;
      }

      // Update balances
      if (from !== ZeroAddress) {
        balances[from]--;
      }
      if (to !== ZeroAddress) {
        balances[to]++;
      }
    } catch (error) {
      console.error(`Error parsing log:`, error);
    }
  }

  // Remove holders with zero balance
  Object.keys(balances).forEach(holder => {
    if (balances[holder] === 0) {
      delete balances[holder];
    }
  });

  return balances;
}

// Function to convert CSV data to string
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

// Function to get random sample of addresses
function getRandomSample<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

task('snapshot:NFT', 'Create a snapshot of NFT holdings')
  .addParam('input', 'Path to input file with NFT addresses (one per line)', 'data/snapshotAddresses.csv', types.string)
  .addParam('output', 'Path to output CSV file', 'data/snapshotNFT.csv', types.string)
  .addParam('block', 'Last block number to consider', 0, types.int)
  .addOptionalParam('limit', 'Limit number of NFT addresses to process', 0, types.int)
  .addOptionalParam('maxBlockInterval', 'Maximum block distance for RPC calls', 100000, types.int)
  .setAction(async (args, hre) => {
    const inputPath = path.resolve(args.input);
    const outputPath = path.resolve(args.output);
    const toBlock = args.block;

    if (toBlock <= 0) {
      throw new Error('Block number must be greater than 0');
    }

    // Read NFT addresses from input file
    const inputContent = fs.readFileSync(inputPath, 'utf8');
    const nftAddresses = inputContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.startsWith('0x'));

    if (nftAddresses.length === 0) {
      throw new Error('No valid NFT addresses found in input file');
    }

    // Apply limit if specified
    const limit = Number(args.limit ?? 0) > 0 ? Number(args.limit) : nftAddresses.length;
    const addressesToProcess = nftAddresses.slice(0, limit);

    console.log(`Found ${nftAddresses.length} NFT addresses in input file`);
    console.log(`Processing ${addressesToProcess.length} NFT addresses (limit: ${limit})`);
    console.log(`Processing up to block ${toBlock}`);

    // Get NFT names and process each contract
    const nftNames: string[] = [];
    const allBalances: Record<string, Record<string, number>> = {};
    const allHolders = new Set<string>();

    for (let i = 0; i < addressesToProcess.length; i++) {
      const nftAddress = addressesToProcess[i];
      console.log(`\nProcessing NFT ${i + 1}/${addressesToProcess.length}: ${nftAddress}`);

      try {
        // Get NFT name
        const erc721 = new Contract(nftAddress, ERC721__factory.abi, hre.ethers.provider);
        const name = await erc721.name();
        nftNames.push(name);
        console.log(`NFT name: ${name}`);

        // Get all Transfer logs
        const logs = await getAllTransferLogs(hre, nftAddress, toBlock, args.maxBlockInterval);
        console.log(`Found ${logs.length} Transfer logs`);

        // Process logs to get balances
        const balances = processTransferLogs(logs, nftAddress);
        allBalances[nftAddress] = balances;

        // Collect all holders
        Object.keys(balances).forEach(holder => allHolders.add(holder));

        console.log(`Found ${Object.keys(balances).length} holders`);

        // Sanity checks
        let totalSupply: bigint | null = null;
        try {
          totalSupply = await (erc721 as Contract)['totalSupply()']();
          console.log(`Total supply from contract: ${totalSupply}`);
        } catch (error) {
          console.log(`Warning: totalSupply() not available for ${nftAddress}: ${error}`);
        }

        const calculatedTotalSupply = Object.values(balances).reduce((sum, balance) => sum + balance, 0);
        console.log(`Calculated total supply: ${calculatedTotalSupply}`);

        if (totalSupply !== null) {
          console.log(`Supply match: ${totalSupply.toString() === calculatedTotalSupply.toString()}`);
        }

        // Check random addresses
        const holders = Object.keys(balances);
        if (holders.length > 0) {
          const randomHolders = getRandomSample(holders, Math.min(20, holders.length));
          console.log('Checking random holder balances:');

          for (const holder of randomHolders) {
            try {
              const contractBalance = await erc721.balanceOf(holder);
              const calculatedBalance = balances[holder] || 0;
              const match = contractBalance.toString() === calculatedBalance.toString();
              if (!match) {
                console.log(`  Mismatch for ${nftAddress}: ${holder}: contract=${contractBalance}, calculated=${calculatedBalance}, match=${match}`);
              }
            } catch (error) {
              console.log(`  ${holder}: Error checking balance - ${error}`);
            }
          }
        }

      } catch (error) {
        console.error(`Error processing NFT ${nftAddress}:`, error);
        nftNames.push('Error');
        allBalances[nftAddress] = {};
      }
    }

    // Clear progress line
    printProgress('100');
    console.log();

    // Generate CSV output
    const csvLines: string[] = [];

    // Header row
    const header = ['holder', ...addressesToProcess];
    csvLines.push(toCsvLine(header));

    // Name row
    const nameRow = ['name', ...nftNames];
    csvLines.push(toCsvLine(nameRow));

    // Balance rows
    const sortedHolders = Array.from(allHolders).sort();
    for (const holder of sortedHolders) {
      const balanceRow = [holder];
      for (const nftAddress of addressesToProcess) {
        const balance = allBalances[nftAddress][holder] || 0;
        balanceRow.push(balance.toString());
      }
      csvLines.push(toCsvLine(balanceRow));
    }

    // Write output file
    const outputContent = csvLines.join('\n') + '\n';
    fs.writeFileSync(outputPath, outputContent, 'utf8');

    console.log(`\nSnapshot written to ${outputPath}`);
    console.log(`Total holders: ${allHolders.size}`);
    console.log(`Total NFTs processed: ${addressesToProcess.length}`);
  });
