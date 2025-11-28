import { ratioScale, DEFAULT_DECIMALS } from './constants';

// Type alias for bigint to maintain compatibility
export type BN = bigint;

// Helper to convert various types to bigint
const toBN = (value: number | string | bigint): bigint => {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return BigInt(value);
  }
  return BigInt(value);
};

// Converts an unscaled number to scaled number with the specified number of decimals
// eg convert 3 to 3000000000000000000 with 18 decimals
export const simpleToExactAmount = (
  amount: number | string | bigint,
  decimals: number | bigint = DEFAULT_DECIMALS,
): bigint => {
  // Code is largely lifted from the guts of web3 toWei here:
  // https://github.com/ethjs/ethjs-unit/blob/master/src/index.js
  let amountString = amount.toString();
  const decimalsBN = toBN(decimals);

  if (decimalsBN > 100n) {
    throw new Error(`Invalid decimals amount`);
  }

  const scale = 10n ** decimalsBN;
  const scaleString = scale.toString();

  // Is it negative?
  const negative = amountString.startsWith('-');
  if (negative) {
    amountString = amountString.substring(1);
  }

  if (amountString === '.') {
    throw new Error(
      `Error converting number ${amountString} to precise unit, invalid value`,
    );
  }

  // Split it into a whole and fractional part
  // eslint-disable-next-line prefer-const
  let [whole, fraction, ...rest] = amountString.split('.');
  if (rest.length > 0) {
    throw new Error(
      `Error converting number ${amountString} to precise unit, too many decimal points`,
    );
  }

  if (!whole) {
    whole = '0';
  }
  if (!fraction) {
    fraction = '0';
  }

  if (fraction.length > scaleString.length - 1) {
    throw new Error(
      `Error converting number ${amountString} to precise unit, too many decimal places`,
    );
  }

  while (fraction.length < scaleString.length - 1) {
    fraction += '0';
  }

  const wholeBN = toBN(whole);
  const fractionBN = toBN(fraction);
  let result = wholeBN * scale + fractionBN;

  if (negative) {
    result = -result;
  }

  return result;
};

// How many mAssets is this bAsset worth using bAsset decimal length
// eg convert 3679485 with 6 decimals (3.679485) to 3679485000000000000 with 18 decimals
export const applyDecimals = (
  inputQuantity: number | string | bigint,
  decimals = DEFAULT_DECIMALS,
): bigint => {
  const input = toBN(inputQuantity);
  const dec = toBN(decimals);
  return 10n ** (18n - dec) * input;
};

export const percentToWeight = (percent: number | string | bigint): bigint =>
  simpleToExactAmount(percent, 16);

// How many bAssets is this mAsset worth
export const applyRatioMassetToBasset = (
  input: bigint,
  ratio: bigint | string,
): bigint => {
  const ratioBN = toBN(ratio);
  return (input * ratioScale) / ratioBN;
};

// How many mAssets is this bAsset worth
export const applyRatio = (
  bAssetQ: bigint | string | number,
  ratio: bigint | string,
): bigint => {
  const bAssetQBN = toBN(bAssetQ);
  const ratioBN = toBN(ratio);
  return (bAssetQBN * ratioBN) / ratioScale;
};

// How many mAssets is this bAsset worth
export const applyRatioCeil = (
  bAssetQ: bigint | string,
  ratio: bigint | string,
): bigint => {
  const bAssetQBN = toBN(bAssetQ);
  const ratioBN = toBN(ratio);
  const scaled = bAssetQBN * ratioBN;
  const ceil = scaled + ratioScale - 1n;
  return ceil / ratioScale;
};

export const createMultiple = (decimals: number): bigint => {
  const ratio = 10n ** (18n - BigInt(decimals));
  return ratio * ratioScale;
};

// Returns the smaller number
export const minimum = (a: bigint, b: bigint): bigint => (a <= b ? a : b);

// Returns the bigger number
export const maximum = (a: bigint, b: bigint): bigint => (a >= b ? a : b);

// Returns the sum of two big numbers
export const sum = (a: bigint, b: bigint): bigint => a + b;

export const safeInfinity = 2n ** 256n - 1n;
