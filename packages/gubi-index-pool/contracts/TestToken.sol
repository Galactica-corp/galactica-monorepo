// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

/**
 * @title TestToken
 * @notice A simple ERC20 token for testing purposes.
 * Uses the same contract structure as gUBI for consistency in tests.
 */
contract TestToken is ERC20 {
  constructor(address owner) ERC20('TestToken', 'TEST') {
    _mint(owner, 100_000_000 * 10 ** decimals());
  }
}
