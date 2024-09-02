import * as galois from '@guildofweavers/galois';
import type { ec } from 'elliptic';
import * as ffjavascript from 'ffjavascriptEC';

const srsg1DataRaw = require('../data/taug1_65536.json');

// taken from https://github.com/weijiekoh/libkzg/blob/master/ts/index.ts
type G1Point = ec;
type G2Point = ec;
type Coefficient = bigint;

type Commitment = G1Point;
type Proof = G1Point;

// eslint-disable-next-line prefer-destructuring
const G1 = ffjavascript.bn128.G1;
// eslint-disable-next-line prefer-destructuring
const G2 = ffjavascript.bn128.G2;

// The base field where the curve operates
const FIELD_SIZE = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
);

/**
 * Retrieves the G1 values of the structured reference string.
 * @param depth - The depth of the structured reference string to retrieve.
 * @returns An array of G1 points representing the structured reference string.
 *
 * These values were taken from challenge file #46 of the Perpetual Powers of
 * Tau ceremony. The Blake2b hash of the challenge file is:
 *
 * 939038cd 2dc5a1c0 20f368d2 bfad8686
 * 950fdf7e c2d2e192 a7d59509 3068816b
 * becd914b a293dd8a cb6d18c7 b5116b66
 * ea54d915 d47a89cc fbe2d5a3 444dfbed
 *
 * The challenge file can be retrieved at:
 * https://ppot.blob.core.windows.net/public/challenge_0046
 *
 * The ceremony transcript can be retrieved at:
 * https://github.com/weijiekoh/perpetualpowersoftau
 *
 * Anyone can verify the transcript to ensure that the values in the challenge
 * file have not been tampered with. Moreover, as long as one participant in
 * the ceremony has discarded their toxic waste, the whole ceremony is secure.
 * Please read the following for more information:
 * https://medium.com/coinmonks/announcing-the-perpetual-powers-of-tau-ceremony-to-benefit-all-zk-snark-projects-c3da86af8377
 */
const srsG1 = (depth: number): G1Point[] => {
  const g1: G1Point[] = [];
  for (let i = 0; i < depth; i++) {
    g1.push([
      BigInt(srsg1DataRaw[i][0]),
      BigInt(srsg1DataRaw[i][1]),
      BigInt(1),
    ]);
  }

  return g1;
};

/**
 * Retrieves the G2 values of the structured reference string.
 * @returns The first two TauG2 values of the structured reference string.
 * They were taken from challenge file #46 of the Perpetual Powers of
 * Tau ceremony as described above.
 */
const srsG2 = (): G2Point[] => {
  return [
    G2.g,
    [
      [
        '0x04c5e74c85a87f008a2feb4b5c8a1e7f9ba9d8eb40eb02e70139c89fb1c505a9',
        '0x21a808dad5c50720fb7294745cf4c87812ce0ea76baa7df4e922615d1388f25a',
      ].map(BigInt),
      [
        '0x2d58022915fc6bc90e036e858fbc98055084ac7aff98ccceb0e3fde64bc1a084',
        '0x204b66d8e1fadc307c35187a6b813be0b46ba1cd720cd1c4ee5f68d13036b4ba',
      ].map(BigInt),
      [BigInt(1), BigInt(0)],
    ],
  ];
};

/**
 * Calculate a KZG commitment to a polynomial q, i.e. [q(s)]_1.
 * @returns A KZG commitment to a polynomial.
 * @param coefficients - The coefficients of the polynomial to commit. To
 * generate these coefficients from arbitary values, use
 * genCoefficients().
 */
const commit = (coefficients: bigint[]): Commitment => {
  const srs = srsG1(coefficients.length);
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  return polyCommit(coefficients, G1, srs);
};

const polyCommit = (
  coefficients: bigint[],
  // eslint-disable-next-line id-length
  G: G1Point,
  srs: G1Point[],
): G1Point => {
  let result = G.zero;
  for (let i = 0; i < coefficients.length; i++) {
    const coeff = BigInt(coefficients[i]);
    // assert(coeff >= BigInt(0))

    result = G.affine(G.add(result, G.mulScalar(srs[i], coeff)));

    // if (coeff < 0) {
    // coeff = BigInt(-1) * coeff
    // result = G.affine(G.add(result, G.neg(G.mulScalar(srs[i], coeff))))
    // } else {
    // result = G.affine(G.add(result, G.mulScalar(srs[i], coeff)))
    // }
  }

  return result;
};

/**
 * Given p(x) and xVal, calculate q(x) = (p(x) - p(xVal)) / (x - xVal).
 * @returns A the coefficients to the quotient polynomial used to generate a
 * KZG proof.
 * @param coefficients - The coefficients of the polynomial.
 * @param xVal - The x-value for the polynomial evaluation proof.
 * @param p - The field size. Defaults to the BabyJub field size.
 */
const genQuotientPolynomial = (
  coefficients: Coefficient[],
  xVal: bigint,
  // eslint-disable-next-line id-length
  p: bigint = FIELD_SIZE,
): Coefficient[] => {
  const field = galois.createPrimeField(p);
  const poly = field.newVectorFrom(coefficients);

  const yVal = field.evalPolyAt(poly, xVal);
  const y = field.newVectorFrom([yVal]);

  const x = field.newVectorFrom([0, 1].map(BigInt));

  const z = field.newVectorFrom([xVal].map(BigInt));

  return field
    .divPolys(field.subPolys(poly, y), field.subPolys(x, z))
    .toValues();
};

/**
 * Given p(x) and xVal, calculate the proof for the fact that p(xVal) = yVal. The proof is [q(s)]_1 calculated by genQuotientPolynomial.
 * @returns A KZG commitment proof of evaluation at a single point.
 * @param coefficients - The coefficients of the polynomial associated with the
 * KZG commitment.
 * @param index - The x-value for the polynomial evaluation proof.
 * @param p - The field size. Defaults to the BabyJub field size.
 */
const genProof = (
  coefficients: Coefficient[],
  index: number | bigint,
  // eslint-disable-next-line id-length
  p: bigint = FIELD_SIZE,
): Proof => {
  const quotient = genQuotientPolynomial(coefficients, BigInt(index), p);
  return commit(quotient);
};

/**
 * Calculate the coefficients to a polynomial which intersects the points (0,values[0]) ... (n, values[n]). Each value must be less than FIELD_SIZE. Likewise, each resulting coefficient will be less than FIELD_SIZE. This is because all operations in this function work in a finite field of prime order p = FIELD_SIZE. The output of this function can be fed into commit() to produce a KZG polynomial commitment to said polynomial.
 * @param values - The values to interpolate.
 * @param p - The field size. Defaults to the BabyJub field size.
 * @returns The coefficients to the polynomial which interpolates the given points.
 */
const genCoefficients = (
  values: bigint[],
  // eslint-disable-next-line id-length
  p: bigint = FIELD_SIZE,
): Coefficient[] => {
  // Check the inputs
  /* for (let value of values) {
        assert(typeof(value) === 'bigint', "unsupported type")
        assert(value < FIELD_SIZE, "value out of range")
    } */

  // Perform the interpolation
  const field = galois.createPrimeField(p);
  // eslint-disable-next-line id-length
  const x: bigint[] = [];
  for (let i = 0; i < values.length; i++) {
    x.push(BigInt(i));
  }
  const xVals = field.newVectorFrom(x);
  const yVals = field.newVectorFrom(values);
  const coefficients = field.interpolate(xVals, yVals).toValues();

  // Check the outputs
  /*     for (let coefficient of coefficients) {
        assert(coefficient < FIELD_SIZE)
    } */
  return coefficients;
};

export {
  srsG1,
  srsG2,
  commit,
  genQuotientPolynomial,
  genProof,
  genCoefficients,
};
