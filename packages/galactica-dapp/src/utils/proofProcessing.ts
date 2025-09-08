import { BigNumber } from 'bignumber.js';

// not using the functions from zk-certificates package here to simplify dependencies and work around webpack issue

/**
 * Converts a hex string to a decimal string.
 *
 * @param hexIn - Hex string to convert.
 * @returns Decimal string.
 */
export function fromHexToDec(hexIn: string): string {
  if (hexIn.startsWith('0x')) {
    return new BigNumber(hexIn.slice(2).toUpperCase(), 16).toString(10);
  }
  return new BigNumber(hexIn, 16).toString(10);
}

/**
 * Converts a decimal string to a hex string.
 *
 * @param dec - Decimal string to convert.
 * @param withPrefix - Whether to add '0x' prefix.
 * @returns Hex string.
 */
export function fromDecToHex(dec: string, withPrefix = false): string {
  if (withPrefix) {
    return `0x${new BigNumber(dec, 10).toString(16)}`;
  }
  return new BigNumber(dec, 10).toString(16);
}

/**
 * This function convert the proof output from snarkjs to parameter format for onchain solidity verifier.
 *
 * @param proof - Proof output from snarkjs.
 * @returns Formatted proof.
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

  console.log(
    `Formated proof: ${JSON.stringify({ a: piA, b: piB, c: piC }, null, 2)}`,
  );

  return [piA, piB, piC];
}

/**
 * Processes the public inputs.
 *
 * @param publicSignals - Public signals.
 * @returns Formatted public inputs.
 */
export function processPublicSignals(publicSignals: any) {
  const formatedInputs = publicSignals.map((value: any) =>
    fromDecToHex(value, true),
  );
  console.log(
    `Formated publicInputs: ${JSON.stringify(formatedInputs, null, 2)}`,
  );
  return formatedInputs;
}
