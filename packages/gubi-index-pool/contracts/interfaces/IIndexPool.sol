// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20Burnable} from './IERC20Burnable.sol';

/**
 * @title Interface for the Galactica Index Pool.
 * @notice Interface for the index pool that holds tokens and releases them for burning gUBI tokens.
 */
interface IIndexPool {
  /**
   * @notice Burns the index token and distributes the underlying tokens to the caller.
   * @param _amount The amount of index tokens to burn.
   */
  function burnIndexToken(uint256 _amount) external;

  /**
   * @notice Burns the index token and distributes the underlying tokens to the caller, skipping potentially broken or unwanted tokens.
   * @param _amount The amount of index tokens to burn.
   * @param _skipTokens The addresses of the tokens to skip.
   */
  function burnIndexTokenAndSkipSomeTokens(
    uint256 _amount,
    address[] memory _skipTokens
  ) external;

  /**
   * @notice Returns the list of tokens held in the index pool.
   * @return An array of token addresses held in the pool.
   */
  function getHeldTokens() external view returns (address[] memory);

  /**
   * @notice Returns the address of the index token.
   * @return The address of the index token.
   */
  function indexToken() external view returns (IERC20Burnable);

  /**
   * @notice Adds a token to the index pool.
   * @param _token The address of the token to add.
   */
  function addToken(address _token) external;

  /**
   * @notice Adds multiple tokens to the index pool.
   * @param _tokens An array of token addresses to add.
   */
  function addTokenBatch(address[] memory _tokens) external;
}
