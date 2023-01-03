import BigNumber from 'bignumber.js';

// TODO: use functions from zkKYC module instead

export function fromHexToDec(hex: string): string {
  if (hex.slice(0, 2) === '0x') {
    return new BigNumber(hex.slice(2).toUpperCase(), 16).toString(10);
  }
  return new BigNumber(hex, 16).toString(10);
}

export function fromDecToHex(dec: string, withPrefix = false): string {
  if (withPrefix) {
    return `0x${new BigNumber(dec, 10).toString(16)}`;
  }
  return new BigNumber(dec, 10).toString(16);
}

// this function convert the proof output from snarkjs to parameter format for onchain solidity verifier
export function processProof(proof: any) {
  const a = proof.pi_a.slice(0, 2).map((x: any) => fromDecToHex(x, true));
  // for some reason the order of coordinate is reverse
  const b = [
    [proof.pi_b[0][1], proof.pi_b[0][0]].map((x) => fromDecToHex(x, true)),
    [proof.pi_b[1][1], proof.pi_b[1][0]].map((x) => fromDecToHex(x, true)),
  ];

  const c = proof.pi_c.slice(0, 2).map((x: any) => fromDecToHex(x, true));
  return [a, b, c];
}

// this function processes the public inputs
export function processPublicSignals(publicSignals: any) {
  return publicSignals.map((x: any) => fromDecToHex(x, true));
}
