/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

// eslint-disable-next-line @typescript-eslint/naming-convention -- It's a constructor
import { BigNumber } from 'bignumber.js';
import { Buffer } from 'buffer';
import { randomBytes } from 'ethers';
import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import { hashMessage, type Poseidon } from './poseidon';

/**
 * Overwrites build artifacts to inject generated bytecode.
 * @param hre - Hardhat runtime environment.
 * @param contractName - Contract name to overwrite.
 * @param bytecode - Bytecode to inject.
 * @returns Promise for completion.
 */
export async function overwriteArtifact(
  hre: HardhatRuntimeEnvironment,
  contractName: string,
  bytecode: string,
): Promise<void> {
  const artifact = await hre.artifacts.readArtifact(contractName);
  artifact.bytecode = bytecode;
  await hre.artifacts.saveArtifactAndDebugFile(artifact);
}

export const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * Converts hex string to decimal string.
 * @param hexInput - Hex string to convert.
 * @returns Decimal string.
 */
export function fromHexToDec(hexInput: string): string {
  if (hexInput.startsWith('0x')) {
    return new BigNumber(hexInput.slice(2).toUpperCase(), 16).toString(10);
  }
  return new BigNumber(hexInput, 16).toString(10);
}

/**
 * Converts decimal string to hex string.
 * @param decInput - Decimal string to convert.
 * @param withPrefix - Whether to add '0x' prefix (false by default).
 * @returns Hex string.
 */
export function fromDecToHex(decInput: string, withPrefix = false): string {
  let hexDigits = new BigNumber(decInput, 10).toString(16);
  if (hexDigits.length % 2) {
    // make sure the hex string has even number of digits
    hexDigits = `0${hexDigits}`;
  }
  if (withPrefix) {
    return `0x${hexDigits}`;
  }
  return hexDigits;
}

/**
 * Converts hex string to bytes32.
 * @param hexInput - Hex string to convert.
 * @returns Bytes32 string.
 */
export function fromHexToBytes32(hexInput: string): string {
  if (hexInput.length <= 64) {
    return `0x${new Array(64 - hexInput.length + 1).join(`0`)}${hexInput}`;
  }
  throw new Error('hex string too long');
}

/**
 * Generates an array of random bytes32.
 * @param length - Length of the array.
 * @returns Array of random bytes32.
 */
export function generateRandomBytes32Array(length: number): string[] {
  const result = [];
  for (let i = 0; i < length; i++) {
    result.push(fromHexToBytes32(Buffer.from(randomBytes(32)).toString('hex')));
  }
  return result;
}

/**
 * Generates an array of random numbers.
 * @param length - Length of the array.
 * @returns Array of random numbers.
 */
export function generateRandomNumberArray(length: number): number[] {
  const result = [];
  for (let i = 0; i < length; i++) {
    result.push(
      Number(fromHexToDec(Buffer.from(randomBytes(2)).toString('hex'))),
    );
  }
  return result;
}

/**
 * Hashes string to field number using poseidon. This is needed to break down the string into field elements that can be used in the circuit.
 * @param input - String to be hashed.
 * @param poseidon - Poseidon object for hashing (passed to avoid rebuilding with await).
 * @returns Field number as BigNumber.
 */
export function hashStringToFieldNumber(
  input: string,
  poseidon: Poseidon,
): string {
  const hash = hashMessage(poseidon, input);
  return poseidon.F.toString(hash);
}

/**
 * Convert typed byte array to bigint.
 * @param array - Array to convert.
 * @returns Bigint.
 */
export function arrayToBigInt(array: Uint8Array): bigint {
  // Initialize result as 0
  let result = 0n;

  // Loop through each element in the array
  array.forEach((element) => {
    // Shift result bits left by 1 byte
    result <<= 8n;

    // Add element to result, filling the last bit positions
    result += BigInt(element);
  });
  return result;
}

/**
 * Convert bigint to byte array.
 * @param bn - Bigint.
 * @returns Byte array.
 */
export function bigIntToArray(bn: bigint): Uint8Array {
  // Convert bigint to hex string
  let hexValue = BigInt(bn).toString(16);

  // If hex is odd length then add leading zero
  if (hexValue.length % 2) {
    hexValue = `0${hexValue}`;
  }

  // Convert hex array to uint8 byte array
  return Buffer.from(hexValue, 'hex');
}

/**
 * Converts a hex string to a bigint.
 * @param hexString - Hex string to convert.
 * @returns Bigint.
 */
export function hexStringToBigInt(hexString: string): bigint {
  return BigInt(hexString);
}

/**
 * Converts the proof output from snarkjs to parameter format for onchain solidity verifier.
 * @param proof - Proof output from snarkjs.
 * @returns Proof in format for solidity.
 */
export function processProof(proof: any) {
  const piA = proof.pi_a
    .slice(0, 2)
    .map((value: any) => fromDecToHex(value, true));
  // for some reason the order of coordinate is reverse
  const piB = [
    [proof.pi_b[0][1], proof.pi_b[0][0]].map((value) =>
      fromDecToHex(value, true),
    ),
    [proof.pi_b[1][1], proof.pi_b[1][0]].map((value) =>
      fromDecToHex(value, true),
    ),
  ];

  const piC = proof.pi_c
    .slice(0, 2)
    .map((value: any) => fromDecToHex(value, true));
  return [piA, piB, piC];
}

/**
 * Converts the public inputs from snarkjs to parameter format for onchain solidity verifier.
 * @param publicSignals - Public inputs from snarkjs.
 * @returns Public inputs in format for solidity.
 */
export function processPublicSignals(publicSignals: any) {
  return publicSignals.map((value: any) => fromDecToHex(value, true));
}

/**
 * Command line helper to print progress in percent.
 * @param progress - Progress in percent.
 */
export function printProgress(progress: string) {
  /* eslint-disable no-restricted-globals */
  process.stdout.clearLine(-1);
  process.stdout.cursorTo(0);
  process.stdout.write(`${progress}%`);
  /* eslint-enable no-restricted-globals */
}

/**
 * Sleep for a given number of seconds.
 * @param seconds - Number of seconds to sleep.
 * @returns Promise for completion.
 */
export async function sleep(seconds: number): Promise<void> {
  if (seconds > 0) {
    console.log(`Waiting for ${seconds} seconds`);
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
  throw new Error('Invalid sleep time');
}
