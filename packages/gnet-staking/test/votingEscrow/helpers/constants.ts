/* eslint-disable max-classes-per-file */
import { keccak256, toUtf8Bytes } from 'ethers';

/**
 * @notice This file contains constants relevant across the mStable test suite
 * Wherever possible, it should conform to fixed on chain vars
 */

export const ratioScale = 10n ** 8n;
export const fullScale = 10n ** 18n;

export const DEFAULT_DECIMALS = 18;

export const DEAD_ADDRESS = '0x0000000000000000000000000000000000000001';
export const ZERO_KEY =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

export const MAX_UINT256 = 2n ** 256n - 1n;
export const MAX_INT128 = 2n ** 127n - 1n;
export const MIN_INT128 = -(2n ** 127n);

export const ONE_MIN = 60n;
export const TEN_MINS = 600n;
export const ONE_HOUR = 3600n;
export const ONE_DAY = 86400n;
export const FIVE_DAYS = 432000n;
export const TEN_DAYS = 864000n;
export const ONE_WEEK = 604800n;
export const ONE_YEAR = 31536000n;
export const TWO_YEARS = 63072000n;

export const KEY_SAVINGS_MANAGER = keccak256(toUtf8Bytes('SavingsManager'));
export const KEY_PROXY_ADMIN = keccak256(toUtf8Bytes('ProxyAdmin'));
export const KEY_LIQUIDATOR = keccak256(toUtf8Bytes('Liquidator'));
