// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;

import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import {Ownable2StepUpgradeable} from '@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol';
import {ReentrancyGuardUpgradeable} from '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import {Math} from '@openzeppelin/contracts/utils/math/Math.sol';
import {Fallback} from '@galactica-net/zk-certificates/contracts/helpers/Fallback.sol';
import {WGNET10} from './WGNET10.sol';

/**
 * @title Staking
 * @notice Staking contract for the native EVM token. This contract will be the implementation behind an upgradeable Proxy contract.
 */
contract Staking is
  Ownable2StepUpgradeable,
  ReentrancyGuardUpgradeable,
  Fallback
{
  WGNET10 public wGNET;
  mapping(address => uint) public stakes;
  uint public totalStake;

  uint[] public checkPoints;
  uint[] public rewardPerSecond;
  uint public lastUpdateTime;
  uint public rewardPerTokenStored; // per 1 Token, i.e. per 10**18 units

  uint public unstakingFeeRatio;
  uint public newUnstakingFeeRatio;
  uint public unstakingFeeRatioTimelock;
  uint public totalCollectedFees;

  // constants are ok to be defined in an upgradeable contract because they are not in storage
  uint public constant UNSTAKING_FEE_RATIO_TIMELOCK_PERIOD = 24 * 60 * 60; // 1 day
  uint public constant UNSTAKING_FEE_DENOMINATOR = 1e4;
  uint public constant TOKEN_UNITS = 1e18;

  uint public startingCheckPoint;
  mapping(address => uint) public userRewardPerTokenPaid;
  mapping(address => uint) public rewards;

  // new variables introduced in new version need to be last to avoid storage conflicts when upgrading

  event CreateStake(address indexed caller, uint amount);
  event RemoveStake(address indexed caller, uint amount);
  event RewardPaid(address indexed user, uint reward);
  event FeeChangeRequested(uint newUnstakingFeeRatio);
  event FeeChanged(uint newUnstakingFeeRatio);
  event EmissionPeriodAdded(uint startTime, uint endTime, uint rewardPerSecond);
  event ExtraRewardProvided(address indexed user, uint amount);

  error InvalidOwnerAddress();
  error InvalidRecipientAddress();
  error InsufficientStake();
  error FeeTooHigh();
  error TooEarlyToChangeUnstakingFee();
  error NewCheckpointNotInFuture();
  error FirstEmissionPeriodInvalid();
  error NoUnstakingFeeToWithdraw();
  error ToNotGreaterThanFrom();
  error InsufficientRewardTokens();
  error InvalidUnstakingFee();
  error RecipientsAndAmountsLengthMismatch();

  /**
   * @dev Disable the constructor for the deployment as recommended by OpenZeppelin. Instead the upgradeable proxy will use the initialize function.
   */
  constructor() {
    _disableInitializers();
  }

  /**
   * @notice Receive function used for depositing native tokens to the contract for paying rewards
   */
  receive() external payable {}

  /**
   * @notice Initialize the contract with this function because a smart contract behind a proxy can't have a constructor.
   * @param _unstakingFeeRatio The initial unstaking fee ratio, given a denominator of 1e4
   * @param _owner The owner of the contract
   * @param emissionStart The start time of the emission period
   * @param firstCheckPoint The end time of the first emission period
   * @param _rewardPerSecond The reward per second for the first emission period
   */
  function initialize(
    uint _unstakingFeeRatio,
    address _owner,
    uint emissionStart,
    uint firstCheckPoint,
    uint _rewardPerSecond
  ) public initializer {
    if (_owner == address(0)) {
      revert InvalidOwnerAddress();
    }
    if (firstCheckPoint <= emissionStart) {
      revert FirstEmissionPeriodInvalid();
    }

    unstakingFeeRatio = _unstakingFeeRatio;
    newUnstakingFeeRatio = _unstakingFeeRatio;
    unstakingFeeRatioTimelock = type(uint).max;
    if (checkPoints.length == 0) {
      checkPoints.push(emissionStart);
      checkPoints.push(firstCheckPoint);
      rewardPerSecond.push(_rewardPerSecond);
      emit EmissionPeriodAdded(
        emissionStart,
        firstCheckPoint,
        _rewardPerSecond
      );
    }
    __ReentrancyGuard_init();
    __Ownable_init(_owner);
  }

  function setWGNET(address payable _wGNET) public onlyOwner {
    wGNET = WGNET10(_wGNET);
  }

  /**
   * @notice Create a stake by depositing the native token. The token amount is passed in the transaction value.
    stake The amount of tokens to stake.
   */
  function createStake() public payable nonReentrant updateReward(msg.sender) {
    uint stake = msg.value;
    stakes[msg.sender] += stake;
    totalStake += stake;

    emit CreateStake(msg.sender, stake);
  }

  /**
   * @notice Create a stake by depositing the wGNET token, we convert them to GNET to store in the smart contract
   * @param stake The amount of tokens to stake.
   */
  function createStakeWithWGNET(uint stake) public nonReentrant updateReward(msg.sender) {
    wGNET.transferFrom(msg.sender, address(this), stake);
    wGNET.withdraw(stake);
    stakes[msg.sender] += stake;
    totalStake += stake;

    emit CreateStake(msg.sender, stake);
  }

  /**
   * @notice Create a stake for another user by depositing the native token. The token amount is passed in the transaction value.
   * @param to The address of the user to create a stake for.
   */
  function createStakeFor(
    address to
  ) public payable nonReentrant updateReward(to) {
    if (to == address(0)) {
      revert InvalidRecipientAddress();
    }

    uint stake = msg.value;
    stakes[to] += stake;
    totalStake += stake;

    emit CreateStake(to, stake);
  }

  /**
   * @notice Create a stake for another user by depositing the wGNET token.
   * @param to The address of the user to create a stake for.
   * @param stake The amount of tokens to stake.
   */
  function createStakeForWithWGNET(
    address to,
    uint stake
  ) public nonReentrant updateReward(to) {
    wGNET.transferFrom(msg.sender, address(this), stake);
    wGNET.withdraw(stake);
    stakes[to] += stake;
    totalStake += stake;
    emit CreateStake(to, stake);
  }

  /**
   * @notice Remove a stake by withdrawing the staking token.
   * @param stake The amount of tokens to withdraw.
   * @param maximumFee The maximum unstaking fee the user accepts.
   */
  function removeStake(
    uint stake,
    uint maximumFee
  ) public nonReentrant updateReward(msg.sender) {
    uint unstakingFee = (stake * unstakingFeeRatio) / UNSTAKING_FEE_DENOMINATOR;
    if (unstakingFee > maximumFee) {
      revert FeeTooHigh();
    }
    uint stakeWithoutFee = stake - unstakingFee;
    if (stakes[msg.sender] < stake) {
      revert InsufficientStake();
    }
    stakes[msg.sender] -= stake;
    totalStake -= stake;
    totalCollectedFees += unstakingFee;

    payable(msg.sender).transfer(stakeWithoutFee);
    emit RemoveStake(msg.sender, stake);
  }

  /**
   * @notice Remove a stake by withdrawing the wGNET token.
   * @param stake The amount of tokens to withdraw.
   * @param maximumFee The maximum unstaking fee the user accepts.
   */
  function removeStakeWithWGNET(
    uint stake,
    uint maximumFee
  ) public nonReentrant updateReward(msg.sender) {
    uint unstakingFee = (stake * unstakingFeeRatio) / UNSTAKING_FEE_DENOMINATOR;
    if (unstakingFee > maximumFee) {
      revert FeeTooHigh();
    }
    uint stakeWithoutFee = stake - unstakingFee;
    if (stakes[msg.sender] < stake) {
      revert InsufficientStake();
    }
    stakes[msg.sender] -= stake;
    totalStake -= stake;
    totalCollectedFees += unstakingFee;
    
    wGNET.deposit{value: stakeWithoutFee}();
    wGNET.transfer(msg.sender, stakeWithoutFee);
    emit RemoveStake(msg.sender, stake);
  }

  

  /**
   * @notice Transfer stake to another user.
   * @param _recipient The address of the user to transfer the stake to.
   * @param _amount The amount of stake to transfer.
   */
  function transferStake(address _recipient, uint _amount) public {
    if (_amount > stakes[msg.sender]) {
      revert InsufficientStake();
    }
    if (_recipient == address(0)) {
      revert InvalidRecipientAddress();
    }
    _updateReward(msg.sender);
    _updateReward(_recipient);
    stakes[msg.sender] -= _amount;
    stakes[_recipient] += _amount;
    emit RemoveStake(msg.sender, _amount);
    emit CreateStake(_recipient, _amount);
  }

  /**
   * @notice Claim the reward for the user = msg.sender.
   */
  function getReward() public nonReentrant updateReward(msg.sender) {
    uint reward = rewards[msg.sender];
    if (reward > 0) {
      if (reward > (address(this).balance - totalStake)) {
        revert InsufficientRewardTokens();
      }
      rewards[msg.sender] = 0;
      payable(msg.sender).transfer(reward);
      emit RewardPaid(msg.sender, reward);
    }
  }

  function getRewardWithWGNET() public nonReentrant updateReward(msg.sender) {
    uint reward = rewards[msg.sender];
    if (reward > 0) {
    if (reward > (address(this).balance - totalStake)) {
        revert InsufficientRewardTokens();
      }
      rewards[msg.sender] = 0;
      wGNET.deposit{value: reward}();
      wGNET.transfer(msg.sender, reward);
      emit RewardPaid(msg.sender, reward);
    }
  }

  /**
   * @notice Show the pending reward for a user.
   * @param account The address of the user to show the pending reward for.
   * @return The pending reward.
   */
  function showPendingReward(address account) public view returns (uint) {
    uint rewardPerTokenStoredActual;
    if (totalStake != 0) {
      (uint totalEmittedTokensSinceLastUpdate, ) = getTotalEmittedTokens(
        lastUpdateTime,
        block.timestamp,
        startingCheckPoint
      );
      rewardPerTokenStoredActual =
        rewardPerTokenStored +
        (totalEmittedTokensSinceLastUpdate * TOKEN_UNITS) /
        totalStake;
    } else {
      rewardPerTokenStoredActual = rewardPerTokenStored;
    }
    return
      rewards[account] +
      ((rewardPerTokenStoredActual - userRewardPerTokenPaid[account]) *
        stakes[account]) /
      TOKEN_UNITS;
  }
    /** take reward and add it to the stake so it can also accrue rewards (public function)
   */
  function addRewardToStake(address user) public {
    _addRewardToStake(user);
  }

  /** take reward and add it to the stake so it can also accrue rewards (internal function)
   */
  function _addRewardToStake(address user) internal {
    uint reward = rewards[user];
    if (reward > 0) {
      stakes[user] += reward;
      rewards[user] = 0;
    }
  }

  /**
   * @notice Update the reward for a user.
   * @param account The address of the user to update the reward for.
   */
  function _updateReward(address account) internal {
    if (totalStake != 0) {
      (
        uint totalEmittedTokensSinceLastUpdate,
        uint newStartingCheckPoint
      ) = getTotalEmittedTokens(
          lastUpdateTime,
          block.timestamp,
          startingCheckPoint
        );
      startingCheckPoint = newStartingCheckPoint;
      rewardPerTokenStored +=
        (totalEmittedTokensSinceLastUpdate * TOKEN_UNITS) /
        totalStake;
    }
    lastUpdateTime = lastTimeRewardApplicable();
    if (account != address(0)) {
      uint _rewardPerTokenStored = rewardPerTokenStored;
      rewards[account] +=
        ((_rewardPerTokenStored - userRewardPerTokenPaid[account]) *
          stakes[account]) /
        TOKEN_UNITS;
      userRewardPerTokenPaid[account] = _rewardPerTokenStored;
    }
  }

  modifier updateReward(address account) {
    _updateReward(account);
    _;
  }

  /**
   * @notice Get the stake for a user.
   * @param user The address of the user to get the stake for.
   * @return The stake.
   */
  function getStake(address user) public view returns (uint) {
    return stakes[user];
  }

  /**
   * @notice Register the intent to change the unstaking fee ratio.
   * @param _newUnstakingFeeRatio The new unstaking fee ratio.
   */
  function registerNewUnstakingFeeRatio(
    uint _newUnstakingFeeRatio
  ) public onlyOwner {
    if (_newUnstakingFeeRatio > UNSTAKING_FEE_DENOMINATOR) {
      revert InvalidUnstakingFee();
    }
    newUnstakingFeeRatio = _newUnstakingFeeRatio;
    emit FeeChangeRequested(newUnstakingFeeRatio);

    if (newUnstakingFeeRatio > unstakingFeeRatio) {
      // Require a timelock to protect users from a sudden increase in unstaking fee
      unstakingFeeRatioTimelock =
        block.timestamp +
        UNSTAKING_FEE_RATIO_TIMELOCK_PERIOD;
    } else {
      // Otherwise we can change it immediately as decreasing the unstaking fee cannot harm users and would be beneficial for all pending unstaking operations.
      unstakingFeeRatioTimelock = block.timestamp;
      changeUnstakingFeeRatio();
    }
  }

  /**
   * @notice Change the unstaking fee ratio after the timelock has passed.
   */
  function changeUnstakingFeeRatio() public onlyOwner {
    if (block.timestamp < unstakingFeeRatioTimelock) {
      revert TooEarlyToChangeUnstakingFee();
    }
    unstakingFeeRatio = newUnstakingFeeRatio;
    unstakingFeeRatioTimelock = type(uint).max;
    emit FeeChanged(newUnstakingFeeRatio);
  }

  /**
   * @notice Add a new emission period to the emission schedule.
   * @param checkPoint The end time of the emission period.
   * @param _rewardPerSecond The reward per second for the emission period.
   */
  function updateSchedule(
    uint checkPoint,
    uint _rewardPerSecond
  ) public onlyOwner {
    uint lastCheckPoint = checkPoints[checkPoints.length - 1];
    if (checkPoint <= Math.max(lastCheckPoint, block.timestamp)) {
      revert NewCheckpointNotInFuture();
    }
    if (block.timestamp > lastCheckPoint) {
      checkPoints.push(block.timestamp);
      rewardPerSecond.push(0);
      emit EmissionPeriodAdded(lastCheckPoint, block.timestamp, 0);
      lastCheckPoint = block.timestamp;
    }
    checkPoints.push(checkPoint);
    rewardPerSecond.push(_rewardPerSecond);
    emit EmissionPeriodAdded(lastCheckPoint, checkPoint, _rewardPerSecond);
  }

  /**
   * @notice Get the total amount of unstaking fee collected.
   * @return The amount of unstaking fee collected.
   */
  function getCollectedFees() public view returns (uint) {
    return totalCollectedFees;
  }

  function getCheckPoints() public view returns (uint[] memory) {
    return checkPoints;
  }

  function getRewardPerSecond() public view returns (uint[] memory) {
    return rewardPerSecond;
  }

  /**
   * @notice Get the last time the reward is applicable.
   * @return The last time the reward is applicable.
   */
  function lastTimeRewardApplicable() public view returns (uint) {
    return Math.min(block.timestamp, checkPoints[checkPoints.length - 1]);
  }

  /**
   * @notice Get the total emitted tokens for a given time range
   * @param _from The start time of the time range
   * @param _to The end time of the time range
   * @param _startingCheckPoint The index of the first check point to consider. For gas efficiency reasons, we don't want to iterate over all historical check points to find this.
   * @return The total emitted tokens and the index of the last check point considered
   */
  function getTotalEmittedTokens(
    uint _from,
    uint _to,
    uint _startingCheckPoint
  ) public view returns (uint, uint) {
    if (_to < _from) {
      revert ToNotGreaterThanFrom();
    }
    uint totalEmittedTokens = 0;

    // The time to start calculating rewards from. We'll update it for each emission period we iterate over
    uint nextStartTime = Math.max(_from, checkPoints[_startingCheckPoint]);
    if (_to <= nextStartTime) {
      // Return 0 because the time range is before the first emission period
      return (0, _startingCheckPoint);
    }
    uint checkPointsLength = checkPoints.length;
    for (uint i = _startingCheckPoint + 1; i < checkPointsLength; ++i) {
      uint emissionEndTime = checkPoints[i];
      uint emissionRate = rewardPerSecond[i - 1];
      if (_to < emissionEndTime) {
        // End time is in a defined emission period, so we only add the reward for the time until _to
        totalEmittedTokens += (_to - nextStartTime) * emissionRate;
        return (totalEmittedTokens, i - 1);
      } else if (nextStartTime < emissionEndTime) {
        // Iterating over a emission period that is completely within the time range
        totalEmittedTokens += (emissionEndTime - nextStartTime) * emissionRate;
        nextStartTime = emissionEndTime;
      }
    }
    // If we reached the end of the defined emission period array, we return the total emitted tokens and the last check point index
    return (totalEmittedTokens, checkPointsLength - 1);
  }

  /**
   * @notice Distributes extra rewards to users in batches. It can be claimed with the getReward function.
   * @param _recipients The addresses to airdrop the tokens to.
   * @param _amounts The amounts of tokens to airdrop to each address.
   */
  function distributeExtraRewards(
    address[] memory _recipients,
    uint[] memory _amounts
  ) public payable {
    if (_recipients.length != _amounts.length) {
      revert RecipientsAndAmountsLengthMismatch();
    }

    uint totalAmount = 0;
    for (uint i = 0; i < _recipients.length; i++) {
      totalAmount += _amounts[i];
    }

    require(msg.value == totalAmount, 'Insufficient funds');

    for (uint256 i = 0; i < _recipients.length; i++) {
      rewards[_recipients[i]] += _amounts[i];
      emit ExtraRewardProvided(_recipients[i], _amounts[i]);
    }
  }
}
