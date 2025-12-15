// import { MassetMachine, MassetDetails } from "./machines"
import { assert } from 'chai';

import { fullScale } from './constants';
import type { BN } from './math';
import { simpleToExactAmount } from './math';

// Helper to convert various types to bigint
const toBN = (value: BN | string | number | bigint): bigint => {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return BigInt(value);
  }
  if (typeof value === 'string') {
    return BigInt(value);
  }
  return value; // already BN (bigint)
};

/**
 * Convenience method to assert that two BN instances are within variance units of each other.
 *
 * @param actual The BN instance you received
 * @param expected The BN amount you expected to receive, allowing a variance of +/- variance units
 * @param variance The allowed variance as a string or number (e.g., "10" for 10 units)
 * @param reason Optional reason for the assertion
 */
export const assertBNClose = (
  actual: BN | string | number,
  expected: BN | string | number,
  variance: BN | number = 10n,
  reason?: string,
): void => {
  const actualBN = toBN(actual);
  const expectedBN = toBN(expected);
  const varianceBN = toBN(variance);
  const actualDelta =
    actualBN > expectedBN ? actualBN - expectedBN : expectedBN - actualBN;

  const str = reason
    ? `\n\tReason: ${reason}\n\t${actualBN.toString()} vs ${expectedBN.toString()}`
    : '';
  assert.ok(
    actualBN >= expectedBN - varianceBN,
    `Number is too small to be close (Delta between actual and expected is ${actualDelta.toString()}, but variance was only ${varianceBN.toString()}${str}`,
  );
  assert.ok(
    actualBN <= expectedBN + varianceBN,
    `Number is too large to be close (Delta between actual and expected is ${actualDelta.toString()}, but variance was only ${varianceBN.toString()})${str}`,
  );
};

/**
 * Convenience method to assert that two BN instances are within a percentage variance of each other.
 *
 * @param a The first BN instance
 * @param b The second BN instance
 * @param variance The allowed variance as a string or number (e.g., "0.02" for 2%)
 * @param reason Optional reason for the assertion
 */
export const assertBNClosePercent = (
  a: BN,
  b: BN,
  variance: string | number = '0.02',
  reason?: string,
): void => {
  if (a === b) {
    return;
  }
  const varianceBN = simpleToExactAmount(
    variance.toString().substring(0, 6),
    16,
  );
  const diff = ((a > b ? a - b : b - a) * 2n * fullScale) / (a + b);
  const str = reason
    ? `\n\tReason: ${reason}\n\t${a.toString()} vs ${b.toString()}`
    : '';
  assert.ok(
    diff <= varianceBN,
    `Numbers exceed ${variance}% diff (Delta between a and b is ${diff.toString()}%, but variance was only ${varianceBN.toString()})${str}`,
  );
};

/**
 * Convenience method to assert that one BN instance is GTE the other
 *
 * @param actual The BN instance you received
 * @param comparison The operand to compare against
 */
export const assertBnGte = (actual: BN, comparison: BN): void => {
  assert.ok(
    actual >= comparison,
    `Number must be GTE comparitor, got: ${actual.toString()}; comparitor: ${comparison.toString()}`,
  );
};

/**
 * Convenience method to assert that one BN number is eq to, or greater than an expected value by some small amount
 *
 * @param actual The BN instance you received
 * @param equator The BN to equate to
 * @param maxActualShouldExceedExpected Upper limit for the growth
 * @param mustBeGreater Fail if the operands are equal
 * @param reason Optional reason for the assertion
 */
export const assertBNSlightlyGT = (
  actual: BN,
  equator: BN,
  maxActualShouldExceedExpected: BN | number = 100n,
  mustBeGreater = false,
  reason?: string,
): void => {
  const maxBN = toBN(maxActualShouldExceedExpected);
  const actualDelta = actual > equator ? actual - equator : equator - actual;

  const str = reason
    ? `\n\t${reason}\n\t${actual.toString()} vs ${equator.toString()}`
    : '';

  assert.ok(
    mustBeGreater ? actual > equator : actual >= equator,
    `Actual value should be greater than the expected value ${str}`,
  );
  assert.ok(
    actual <= equator + maxBN,
    `Actual value should not exceed ${maxBN.toString()} units greater than expected. Variance was ${actualDelta.toString()} ${str}`,
  );
};

/**
 * Convenience method to assert that one BN number is eq to, or greater than an expected value by some small amount
 *
 * @param actual The BN instance you received
 * @param equator The BN to equate to
 * @param maxPercentIncrease Percentage amount of increase, as a string (1% = 1)
 * @param mustBeGreater Fail if the operands are equal
 */
export const assertBNSlightlyGTPercent = (
  actual: BN,
  equator: BN,
  maxPercentIncrease = '0.1',
  mustBeGreater = false,
): void => {
  const maxIncreaseBN = simpleToExactAmount(maxPercentIncrease, 16);
  const maxIncreaseUnits = (equator * maxIncreaseBN) / fullScale;
  // const actualDelta = actual.gt(equator) ? actual.sub(equator) : equator.sub(actual);

  assert.ok(
    mustBeGreater ? actual > equator : actual >= equator,
    `Actual value should be greater than the expected value`,
  );
  assert.ok(
    actual <= equator + maxIncreaseUnits,
    `Actual value should not exceed ${maxPercentIncrease}% greater than expected`,
  );
};

// export const assertBasketIsHealthy = async (machine: MassetMachine, md: MassetDetails): Promise<void> => {
//     // Read full basket composition
//     const composition = await machine.getBasketComposition(md)
//     // Assert sum of bAssets in vault storage is gte to total supply of mAsset
//     assertBnGte(composition.sumOfBassets, composition.totalSupply.add(composition.surplus))
//     // No basket weight should be above max
//     // composition.bAssets.forEach((b, i) => {
//     //     expect(b.overweight).to.eq(false)
//     // })
//     // Actual tokens held should always gte vaultBalance
//     composition.bAssets.forEach((b, i) => {
//         expect(b.actualBalance, `assertBasketIsHealthy: Actual balance of ${i} < vaultBalance`).gte(b.vaultBalance)
//     })
//     // Should be not undergoing recol
//     expect(composition.undergoingRecol, "not undergoing recol").to.eq(false)
//     // not failed
//     expect(composition.failed, "mAsset not failed").to.eq(false)
//     // prepareForgeBasset works
//     // Potentially wrap in mock and check event
//     await md.mAsset["getBasset(address)"](md.bAssets[0].address)
// }
