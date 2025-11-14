// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {Ownable2StepUpgradeable} from '@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol';
import {ReentrancyGuardUpgradeable} from '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import {IERC20Burnable} from './interfaces/IERC20Burnable.sol';
import {IIndexPool} from './interfaces/IIndexPool.sol';

/**
 * @title Galactica Index Pool.
 * @notice The index pool holds tokens and releases them for burning the gUBI index pool token.
 * @notice This contract will be the implementation behind an upgradeable Proxy contract.
 */
contract IndexPool is
  IIndexPool,
  Ownable2StepUpgradeable,
  ReentrancyGuardUpgradeable
{
  using SafeERC20 for IERC20;

  IERC20Burnable public indexToken;
  address[] public heldTokens;

  event IndexTokenBurned(address indexed userAddress, uint amount);
  event TokenAdded();

  error InvalidIndexTokenAddress();
  error InvalidOwnerAddress();
  error SkipArrayNotInSameOrderAsHeldTokensArray();
  error TokenCanNotBeAddedTwice();

  /**
   * @dev Disable the constructor for the deployment as recommended by OpenZeppelin. Instead the upgradeable proxy will use the initialize function.
   */
  constructor() {
    _disableInitializers();
  }

  /**
   * @notice Initialize the contract with this function because a smart contract behind a proxy can't have a constructor.
   * @param _indexToken The address of the index token (gUBI).
   * @param _owner The owner of the contract.
   */
  function initialize(address _indexToken, address _owner) public initializer {
    // Sanitize address inputs
    if (_indexToken == address(0)) {
      revert InvalidIndexTokenAddress();
    }
    if (_owner == address(0)) {
      revert InvalidOwnerAddress();
    }

    indexToken = IERC20Burnable(_indexToken);
    __ReentrancyGuard_init();
    __Ownable_init(_owner);
  }

  /**
   * @notice Burns the index token and distributes the underlying tokens to the caller.
   * @param _amount The amount of index tokens to burn.
   */
  function burnIndexToken(uint256 _amount) external {
    // Distribute all indexed tokens by default
    address[] memory emptyArray = new address[](0);
    burnIndexTokenAndSkipSomeTokens(_amount, emptyArray);
  }

  /**
   * @notice Burns the index token and distributes the underlying tokens to the caller, skipping potentially broken or unwanted tokens.
   * @dev This skipping feature of this function is a security consideration to prevent bugged tokens in the pool from bricking the whole pool. This option was chosen over removing tokens from the pool because it is in the user's control and can not be abused by the owner.
   * @param _amount The amount of index tokens to burn.
   * @param _skipTokens The addresses of the tokens to skip. They need to be in the same order as the heldTokens array so that the function can skip them efficiently.
   */
  function burnIndexTokenAndSkipSomeTokens(
    uint256 _amount,
    address[] memory _skipTokens
  ) public nonReentrant {
    uint256 totalSupplyBefore = indexToken.totalSupply();
    // burn the index token directly after snapshotting the total supply as additional reentrance protection
    indexToken.burnFrom(msg.sender, _amount);
    uint256 amountOfPoolBalance;
    uint256 skipIndex = 0;
    for (uint256 i = 0; i < heldTokens.length; i++) {
      // Skip tokens that are in the skipTokens array.
      // Because we require the skipTokens array to be in the same order as the heldTokens array, it suffices to check the next element only.
      if (
        skipIndex < _skipTokens.length &&
        heldTokens[i] == _skipTokens[skipIndex]
      ) {
        skipIndex++;
        continue;
      }

      amountOfPoolBalance =
        (IERC20(heldTokens[i]).balanceOf(address(this)) * _amount) /
        totalSupplyBefore;
      if (amountOfPoolBalance > 0) {
        IERC20(heldTokens[i]).safeTransfer(msg.sender, amountOfPoolBalance);
      }
    }

    // If we have not skipped all tokens to be skipped, it means the skip array is not in the same order as the heldTokens array
    if (skipIndex < _skipTokens.length) {
      revert SkipArrayNotInSameOrderAsHeldTokensArray();
    }

    emit IndexTokenBurned(msg.sender, _amount);
  }

  /**
   * @dev Internal function to add a token to the index pool. Make sure the public facing function checks the onlyOwner modifier. It saves gas because onlyOwner is only checked once.
   * @param _tokenAddress The address of the token to add.
   */
  function _addToken(address _tokenAddress) internal {
    // Check if the token is already in the pool, to prevent distributing it multiple times
    for (uint256 i = 0; i < heldTokens.length; i++) {
      if (heldTokens[i] == _tokenAddress) {
        revert TokenCanNotBeAddedTwice();
      }
    }

    heldTokens.push(_tokenAddress);
    emit TokenAdded();
  }

  /**
   * @notice Adds a token to the index pool.
   * @param _tokenAddress The address of the token to add.
   */
  function addToken(address _tokenAddress) public onlyOwner {
    _addToken(_tokenAddress);
  }

  /**
   * @notice Adds a batch of tokens to the index pool.
   * @param _tokens The addresses of the tokens to add.
   */
  function addTokenBatch(address[] calldata _tokens) external onlyOwner {
    for (uint256 i = 0; i < _tokens.length; i++) {
      _addToken(_tokens[i]);
    }
  }

  function getHeldTokens() external view returns (address[] memory) {
    return heldTokens;
  }
}
