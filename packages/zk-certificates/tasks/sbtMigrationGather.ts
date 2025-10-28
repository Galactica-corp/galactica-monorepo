import { task, types } from 'hardhat/config';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Contract, Interface, ZeroAddress, keccak256, toUtf8Bytes, zeroPadValue } from 'ethers';
import fs from 'fs';
import path from 'path';
import csv from 'csvtojson';

type Row = {
  name: string;
  'reticulum contract': string;
  'issuance will continue after mainnet?': string;
  [key: string]: string;
};

const ERC721_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
];

const ACCESS_CONTROL_ABI = [
  'function hasRole(bytes32 role, address account) view returns (bool)',
];

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

async function getSomeTokenId(hre: HardhatRuntimeEnvironment, address: string): Promise<bigint | null> {
  const provider = hre.ethers.provider;
  const erc721 = new Contract(address, ERC721_ABI, provider);
  // Try to infer a tokenId by scanning first Transfer mint event
  const iface = new Interface(ERC721_ABI);
  const topic = iface.getEventTopic('Transfer');
  const fromZeroTopic = zeroPadValue(ZeroAddress, 32);
  const logs = await provider.getLogs({
    address,
    fromBlock: 0,
    toBlock: 'latest',
    topics: [topic, fromZeroTopic, undefined, undefined],
  }).catch(() => []);
  if (logs.length > 0) {
    const parsed = iface.parseLog(logs[0]);
    return parsed?.args?.tokenId as bigint;
  }
  return null;
}

async function gatherForAddress(hre: HardhatRuntimeEnvironment, address: string) {
  const provider = hre.ethers.provider;
  const erc721 = new Contract(address, ERC721_ABI, provider);
  const name: string = await erc721.name();
  const symbol: string = await erc721.symbol();
  let tokenURI: string | undefined;
  try {
    const anyId = (await getSomeTokenId(hre, address)) ?? 1n;
    tokenURI = await erc721.tokenURI(anyId);
  } catch {
    tokenURI = undefined;
  }
  const contractType = await detectContractType(hre, address);

  // holders: Transfer(from==0x0)
  const iface = new Interface(ERC721_ABI);
  const topic = iface.getEventTopic('Transfer');
  const fromZeroTopic = zeroPadValue(ZeroAddress, 32);
  const logs = await provider.getLogs({
    address,
    fromBlock: 0,
    toBlock: 'latest',
    topics: [topic, fromZeroTopic],
  }).catch(() => []);
  const holders = new Set<string>();
  for (const log of logs) {
    try {
      const parsed = iface.parseLog(log);
      const to = (parsed.args?.to as string).toLowerCase();
      holders.add(to);
    } catch {}
  }

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
  .addOptionalParam('networkName', 'Network to use (e.g., reticulum)', 'reticulum', types.string)
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

    // ensure provider is connected to target network
    if (hre.network.name !== args.networkName) {
      console.warn(`Warning: running on network ${hre.network.name}, expected ${args.networkName}`);
    }

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
        const info = await gatherForAddress(hre, address);
        outLines.push(
          originalRowLine +
            ',' +
            toCsvLine([
              info.contractType,
              info.name,
              info.symbol,
              info.tokenURI,
              info.holdersCount,
              JSON.stringify(info.holders),
            ])
        );
      } catch (err) {
        console.error(`Failed to gather for ${row.name} @ ${address}:`, err);
        outLines.push(originalRowLine + ',' + toCsvLine(['Error', '', '', '', 0, '[]']));
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

    fs.writeFileSync(outputPath, outLines.join('\n') + (outLines[outLines.length - 1]?.endsWith('\n') ? '' : '\n'), 'utf8');
    console.log(`Wrote enriched CSV to ${outputPath}`);
  });

