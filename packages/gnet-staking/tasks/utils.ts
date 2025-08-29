import type { EventFragment, Log } from 'ethers';
import fs from 'fs';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import path from 'path';
import readline from 'readline';

/**
 * Get the address of a deployed contract from the ignition deployed addresses file.
 *
 * @param hre - Hardhat runtime environment.
 * @param futureID - The ignition deployment ID of the contract.
 * @param deploymentId - The ignition deployment ID of the contract (chain-<chainId> by default).
 * @returns The address of the deployed contract.
 */
export async function getDeploymentAddr(
  hre: HardhatRuntimeEnvironment,
  futureID: string,
  deploymentId: string | undefined,
) {
  const { chainId } = await hre.ethers.provider.getNetwork();
  const journalPath = path.join(
    __dirname,
    `../ignition/deployments/${deploymentId ?? `chain-${chainId}`}/deployed_addresses.json`,
  );

  if (!fs.existsSync(journalPath)) {
    throw new Error(
      'Deployment addresses not found. Please deploy the contracts first.',
    );
  }

  const deployment = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  const contractAddr = deployment[futureID];
  return contractAddr;
}

/**
 * Get the deployment block number of a contract from the ignition journal.
 *
 * @param hre - Hardhat runtime environment.
 * @param futureId - The ignition deployment ID of the contract.
 * @param deploymentId - The ignition deployment ID of the contract (chain-<chainId> by default).
 * @returns The block number of the deployed contract.
 */
export async function getDeploymentBlock(
  hre: HardhatRuntimeEnvironment,
  futureId: string,
  deploymentId: string | undefined,
): Promise<number> {
  const { chainId } = await hre.ethers.provider.getNetwork();
  const journalPath = path.join(
    __dirname,
    `../ignition/deployments/${deploymentId ?? `chain-${chainId}`}/journal.jsonl`,
  );

  const journal = fs
    .readFileSync(journalPath, 'utf8')
    .split('\n')
    .map((line: string) => JSON.parse(line || '{}'));
  const deployment = journal.find(
    (entry: any) =>
      entry.futureId === futureId && entry.type === 'TRANSACTION_CONFIRM',
  );
  if (!deployment) {
    throw new Error(
      `Deployment ${futureId} not found in journal ${journalPath}`,
    );
  }
  return Number(deployment.receipt.blockNumber);
}

/**
 * Get logs from a contract in a range of blocks.
 *
 * @param hre - Hardhat runtime environment.
 * @param contract - The address of the contract.
 * @param eventSignatures - The signature of the event to get.
 * @param startBlock - The block number to start fetching logs from.
 * @param endBlock - The block number to stop fetching logs at.
 * @param blockInterval - The interval of blocks to fetch logs in.
 * @returns The logs.
 */
export async function getLogs(
  hre: HardhatRuntimeEnvironment,
  contract: any,
  eventSignatures: EventFragment,
  startBlock: number,
  endBlock: number,
  blockInterval: number,
) {
  console.log(`Fetching events from block ${startBlock} to ${endBlock}`);
  console.log(`Using block intervals of ${blockInterval} blocks`);

  // Initialize array to store all events
  const allEvents = [];

  // Process blocks in chunks to avoid RPC limitations
  for (
    let fromBlock = startBlock;
    fromBlock <= endBlock;
    fromBlock += blockInterval
  ) {
    const toBlock = Math.min(fromBlock + blockInterval - 1, endBlock);

    console.log(
      `Fetching events from block ${fromBlock} to ${toBlock} (${100 - ((endBlock - fromBlock) / (endBlock - startBlock)) * 100}%)`,
    );

    // Query for CreateStake events in the current block range
    let events: Log[] = [];
    let retries = 0;
    const maxRetries = 3;
    while (retries <= maxRetries) {
      try {
        events = await hre.ethers.provider.getLogs({
          address: await contract.getAddress(),
          topics: [eventSignatures.topicHash],
          fromBlock,
          toBlock,
        });
        break;
      } catch (error: any) {
        console.error(
          `Error fetching logs (attempt ${retries + 1}/${maxRetries + 1}):`,
          error.message,
        );
        if (retries === maxRetries) {
          throw error;
        }
        retries += 1;
        console.log(`Retrying in 5 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    const parsedEvents = events.map((log) => {
      return contract.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
    });
    allEvents.push(...parsedEvents);

    // Wait for 200ms to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(
    `Total ${eventSignatures.name} events found: ${allEvents.length}`,
  );

  return allEvents;
}

/**
 * Ask user for confirmation from command line. Ends the program if user does not enter "y"
 *
 * @param question Question to promt the user
 * @returns True if user entered "y", false otherwise
 */
export async function askUserConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/n)`, (answer) => {
      rl.close();
      if (answer === 'y') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

/**
 * Convert a date string to a timestamp.
 *
 * @param dateString - The date string to convert.
 * @returns The timestamp.
 */
export function timestampFromString(dateString: string): number {
  const date = new Date(Date.parse(dateString));

  if (isNaN(date.getTime())) {
    throw new Error(
      `Invalid date string: "${dateString}". Please use a valid date format (e.g. "2024-03-21" or "March 21, 2024")`,
    );
  }

  return Math.floor(date.getTime() / 1000);
}

/**
 * Convert a timestamp to a human readable date string.
 *
 * @param timestamp - The Unix timestamp in seconds.
 * @returns A human readable date string.
 */
export function dateStringFromTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Write a CSV file.
 *
 * @param filename - The filename to write to.
 * @param headers - The headers of the CSV file.
 * @param data - The data to write to the CSV file.
 */
export function writeCSV(
  filename: string,
  headers: string[],
  data: string[][],
) {
  // directory if it doesn't exist
  const dir = path.dirname(filename);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const csvContent = [
    headers.join(','),
    ...data.map((row) => row.join(',')),
  ].join('\n');
  fs.writeFileSync(filename, csvContent);
}

/**
 * Read a CSV file.
 *
 * @param filename - The filename to read.
 * @returns An array of objects where each object uses the CSV headers as keys.
 */
export function readCSV(filename: string): Record<string, string>[] {
  const data = fs.readFileSync(filename, 'utf8');
  const rows = data.split('\n').map((row) => row.split(','));

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((header) => header.replace(/\r/gu, ''));
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] || '';
    });
    return obj;
  });
}
