// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol';

/**
 * @title gUBI (Galactica Universal Basic Income Index Token)
 * @notice The gUBI token is the index token for the Galactica UBI reward system.
 * Users can burn gUBI tokens to receive underlying assets from the index pool.
 */
contract GUBI is ERC20, ERC20Burnable {
  constructor(address initialOwner) ERC20('Galactica UBI Index', 'gUBI') {
    // Mint initial supply to the owner
    _mint(initialOwner, 100_000_000 * 10 ** decimals());
  }
}
