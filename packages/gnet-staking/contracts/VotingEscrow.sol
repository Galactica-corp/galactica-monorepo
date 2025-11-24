// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.28;

import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import {Ownable2StepUpgradeable} from '@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol';
import {ReentrancyGuardUpgradeable} from '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import {IVotingEscrow} from './interfaces/IVotingEscrow.sol';
import {IWGNET10} from './interfaces/IWGNET10.sol';

/// @title  Voting Escrow
/// @notice An ERC20 token that allocates users a virtual balance depending
/// on the amount of tokens locked and their remaining lock duration. The
/// virtual balance decreases linearly with the remaining lock duration.
/// This is the locking mechanism known from veCRV with additional features:
/// - Quit an existing lock and pay a penalty proportional to the remaining lock duration
/// - Reduced pointHistory array size and, as a result, lifetime of the contract
/// - Removed public deposit_for and Aragon compatibility (no use case)
/// - Removed delegate functionality (because voting power on galactica depends on reputation as well, so we can not just delegate stake to someone else)
/// - Usage of this contract is for native gas token (GNET/ETH) and wrapped version of it
/// @dev Builds on BarnBridge's VotingEscrow implementation, that in turn builds on Curve Finance's original VotingEscrow implementation
/// (see https://github.com/BarnBridge/veToken)
/// (see https://github.com/curvefi/curve-dao-contracts/blob/master/contracts/VotingEscrow.vy)
/// and mStable's Solidity translation thereof
/// (see https://github.com/mstable/mStable-contracts/blob/master/contracts/governance/IncentivisedVotingLockup.sol).
contract VotingEscrow is
    IVotingEscrow,
    Ownable2StepUpgradeable,
    ReentrancyGuardUpgradeable
{
    // Shared Events
    event Deposit(
        address indexed provider,
        uint256 value,
        uint256 locktime,
        LockAction indexed action,
        uint256 ts
    );
    event Withdraw(
        address indexed provider,
        uint256 value,
        LockAction indexed action,
        uint256 ts
    );
    event UpdatePenaltyRecipient(address indexed recipient);
    event CollectPenalty(uint256 amount, address indexed recipient);
    event Unlock();

    // Shared global state
    uint256 public constant WEEK = 7 days;
    uint256 public constant MAXTIME = 730 days;
    uint256 public constant MULTIPLIER = 1e18;
    address public penaltyRecipient; // receives collected penalty payments
    uint256 public maxPenalty; // penalty for quitters with MAXTIME remaining lock
    uint256 public penaltyAccumulated; // accumulated and unwithdrawn penalty payments
    uint256 public supply;

    // Lock state
    uint256 public globalEpoch;
    Point[1000000000000000000] public pointHistory; // 1e9 * userPointHistory-length, so sufficient for 1e9 users
    mapping(address => Point[1000000000]) public userPointHistory;
    mapping(address => uint256) public userPointEpoch;
    mapping(uint256 => int128) public slopeChanges;
    mapping(address => LockedBalance) public locked;

    // Voting token
    string public name;
    string public symbol;
    uint256 public decimals;

    // Wrapped token
    IWGNET10 public wGNET;

    // Structs
    struct Point {
        int128 bias;
        int128 slope;
        uint256 ts;
        uint256 blk;
    }
    struct LockedBalance {
        int128 amount;
        uint96 end;
    }

    // Miscellaneous
    enum LockAction {
        CREATE,
        INCREASE_AMOUNT,
        INCREASE_TIME,
        WITHDRAW,
        QUIT
    }

    /// @dev Disable the constructor for the deployment as recommended by OpenZeppelin. Instead the upgradeable proxy will use the initialize function.
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Receive function used to accept native tokens being unwrapped.
     */
    receive() external payable {}

    /// @notice Initializes state
    /// @param _owner Is assumed to be a timelock contract
    /// @param _penaltyRecipient The recipient of penalty paid by lock quitters
    /// @param _name The name of the voting token
    /// @param _symbol The symbol of the voting token
    function initialize(
        address _owner,
        address _penaltyRecipient,
        string memory _name,
        string memory _symbol,
        address payable _wGNET
    ) public initializer {
        pointHistory[0] = Point({
            bias: int128(0),
            slope: int128(0),
            ts: block.timestamp,
            blk: block.number
        });
        name = _name;
        symbol = _symbol;
        penaltyRecipient = _penaltyRecipient;
        wGNET = IWGNET10(_wGNET);

        // set initial values
        maxPenalty = 1e18;
        decimals = 18;

        __ReentrancyGuard_init();
        __Ownable_init(_owner);
    }

    /// ~~~~~~~~~~~~~~~~~~~~~~~~~~~ ///
    ///       Owner Functions       ///
    /// ~~~~~~~~~~~~~~~~~~~~~~~~~~~ ///

    /// @notice Updates the recipient of the accumulated penalty paid by quitters
    function updatePenaltyRecipient(address _addr) external onlyOwner {
        penaltyRecipient = _addr;
        emit UpdatePenaltyRecipient(_addr);
    }

    /// @notice Removes quitlock penalty by setting it to zero
    /// @dev This is an irreversible action and is assumed to be used in
    /// a migration to a new VotingEscrow contract only
    function unlock() external onlyOwner {
        maxPenalty = 0;
        emit Unlock();
    }

    /// @notice Sets the wrapped token address
    function setWGNET(address payable _wGNET) public onlyOwner {
        wGNET = IWGNET10(_wGNET);
    }

    /// ~~~~~~~~~~~~~~~~~~~~~~~~~~~ ///
    ///       LOCK MANAGEMENT       ///
    /// ~~~~~~~~~~~~~~~~~~~~~~~~~~~ ///

    /// @notice Returns a lock's expiration
    /// @param _addr The address of the lock owner
    /// @return Expiration of the lock
    function lockEnd(address _addr) external view returns (uint256) {
        return locked[_addr].end;
    }

    /// @notice Returns a lock's last available user point
    /// @param _addr The address of the lock owner
    /// @return bias The last recorded virtual balance
    /// @return slope The last recorded linear decay
    /// @return ts The last recorded timestamp
    function getLastUserPoint(
        address _addr
    ) external view returns (int128 bias, int128 slope, uint256 ts) {
        uint256 uepoch = userPointEpoch[_addr];
        if (uepoch == 0) {
            return (0, 0, 0);
        }
        Point memory point = userPointHistory[_addr][uepoch];
        return (point.bias, point.slope, point.ts);
    }

    /// @notice Records a checkpoint of both individual and global slope
    /// @param _addr The address of the lock owner, or address(0) for only global
    /// @param _oldLocked Old amount that user had locked, or null for global
    /// @param _newLocked New amount that user has locked, or null for global
    function _checkpoint(
        address _addr,
        LockedBalance memory _oldLocked,
        LockedBalance memory _newLocked
    ) internal {
        Point memory userOldPoint;
        Point memory userNewPoint;
        int128 oldSlopeDelta = 0;
        int128 newSlopeDelta = 0;
        uint256 epoch = globalEpoch;

        if (_addr != address(0)) {
            // Calculate slopes and biases
            // Kept at zero when they have to
            // Casting in the next blocks is safe given that MAXTIME is a small
            // positive number and we check for _oldLocked.end>block.timestamp
            // and _newLocked.end>block.timestamp
            if (_oldLocked.end > block.timestamp && _oldLocked.amount > 0) {
                userOldPoint.slope =
                    _oldLocked.amount /
                    int128(int256(MAXTIME));
                userOldPoint.bias =
                    userOldPoint.slope *
                    int128(int256(_oldLocked.end - block.timestamp));
            }
            if (_newLocked.end > block.timestamp && _newLocked.amount > 0) {
                userNewPoint.slope =
                    _newLocked.amount /
                    int128(int256(MAXTIME));
                userNewPoint.bias =
                    userNewPoint.slope *
                    int128(int256(_newLocked.end - block.timestamp));
            }

            // Moved from bottom final if statement to resolve stack too deep err
            // start {
            // Now handle user history
            uint256 uEpoch = userPointEpoch[_addr];

            userPointEpoch[_addr] = uEpoch + 1;
            userNewPoint.ts = block.timestamp;
            userNewPoint.blk = block.number;
            userPointHistory[_addr][uEpoch + 1] = userNewPoint;

            // } end

            // Read values of scheduled changes in the slope
            // oldLocked.end can be in the past and in the future
            // newLocked.end can ONLY by in the FUTURE unless everything expired: than zeros
            oldSlopeDelta = slopeChanges[_oldLocked.end];
            if (_newLocked.end != 0) {
                if (_newLocked.end == _oldLocked.end) {
                    newSlopeDelta = oldSlopeDelta;
                } else {
                    newSlopeDelta = slopeChanges[_newLocked.end];
                }
            }
        }

        Point memory lastPoint = Point({
            bias: 0,
            slope: 0,
            ts: block.timestamp,
            blk: block.number
        });
        if (epoch > 0) {
            lastPoint = pointHistory[epoch];
        }
        uint256 lastCheckpoint = lastPoint.ts;

        // initialLastPoint is used for extrapolation to calculate block number
        // (approximately, for *At methods) and save them
        // as we cannot figure that out exactly from inside the contract
        Point memory initialLastPoint = Point({
            bias: 0,
            slope: 0,
            ts: lastPoint.ts,
            blk: lastPoint.blk
        });
        uint256 blockSlope = 0; // dblock/dt
        if (block.timestamp > lastPoint.ts) {
            blockSlope =
                (MULTIPLIER * (block.number - lastPoint.blk)) /
                (block.timestamp - lastPoint.ts);
        }
        // If last point is already recorded in this block, slope=0
        // But that's ok b/c we know the block in such case

        // Go over weeks to fill history and calculate what the current point is
        uint256 iterativeTime = _floorToWeek(lastCheckpoint);
        for (uint256 i; i < 255; ) {
            // Hopefully it won't happen that this won't get used in 5 years!
            // If it does, users will be able to withdraw but vote weight will be broken
            iterativeTime = iterativeTime + WEEK;
            int128 dSlope = 0;
            if (iterativeTime > block.timestamp) {
                iterativeTime = block.timestamp;
            } else {
                dSlope = slopeChanges[iterativeTime];
            }
            int128 biasDelta = lastPoint.slope *
                int128(int256((iterativeTime - lastCheckpoint)));
            lastPoint.bias = lastPoint.bias - biasDelta;
            lastPoint.slope = lastPoint.slope + dSlope;
            // This can happen
            if (lastPoint.bias < 0) {
                lastPoint.bias = 0;
            }
            // This cannot happen - just in case
            if (lastPoint.slope < 0) {
                lastPoint.slope = 0;
            }
            lastCheckpoint = iterativeTime;
            lastPoint.ts = iterativeTime;
            lastPoint.blk =
                initialLastPoint.blk +
                (blockSlope * (iterativeTime - initialLastPoint.ts)) /
                MULTIPLIER;

            // when epoch is incremented, we either push here or after slopes updated below
            epoch = epoch + 1;
            if (iterativeTime == block.timestamp) {
                lastPoint.blk = block.number;
                break;
            } else {
                pointHistory[epoch] = lastPoint;
            }
            unchecked {
                ++i;
            }
        }

        globalEpoch = epoch;
        // Now pointHistory is filled until t=now

        if (_addr != address(0)) {
            // If last point was in this block, the slope change has been applied already
            // But in such case we have 0 slope(s)
            lastPoint.slope =
                lastPoint.slope +
                userNewPoint.slope -
                userOldPoint.slope;
            lastPoint.bias =
                lastPoint.bias +
                userNewPoint.bias -
                userOldPoint.bias;
            if (lastPoint.slope < 0) {
                lastPoint.slope = 0;
            }
            if (lastPoint.bias < 0) {
                lastPoint.bias = 0;
            }
        }

        // Record the changed point into history
        pointHistory[epoch] = lastPoint;

        if (_addr != address(0)) {
            // Schedule the slope changes (slope is going down)
            // We subtract new_user_slope from [new_locked.end]
            // and add old_user_slope to [old_locked.end]
            if (_oldLocked.end > block.timestamp) {
                // oldSlopeDelta was <something> - userOldPoint.slope, so we cancel that
                oldSlopeDelta = oldSlopeDelta + userOldPoint.slope;
                if (_newLocked.end == _oldLocked.end) {
                    oldSlopeDelta = oldSlopeDelta - userNewPoint.slope; // It was a new deposit, not extension
                }
                slopeChanges[_oldLocked.end] = oldSlopeDelta;
            }
            if (_newLocked.end > block.timestamp) {
                if (_newLocked.end > _oldLocked.end) {
                    newSlopeDelta = newSlopeDelta - userNewPoint.slope; // old slope disappeared at this point
                    slopeChanges[_newLocked.end] = newSlopeDelta;
                }
                // else: we recorded it already in oldSlopeDelta
            }
        }
    }

    /// @notice Records a new global checkpoint
    function checkpoint() external {
        LockedBalance memory empty;
        _checkpoint(address(0), empty, empty);
    }

    /// @notice Creates a new lock (internal function for processing either native or wrapped token)
    /// @param _unlockTime Expiration time of the lock
    /// @param _value The amount to lock
    /// @dev Assumes that the value is already checked and converted to the native token
    /// `msg.value` is (unsafely) downcasted from `uint256` to `int128`
    /// and `_unlockTime` is (unsafely) downcasted from `uint256` to `uint96`
    /// assuming that the values never reach the respective max values
    function _createLock(
        uint256 _unlockTime,
        uint256 _value
    ) internal nonReentrant {
        uint256 unlock_time = _floorToWeek(_unlockTime); // Locktime is rounded down to weeks
        LockedBalance memory locked_ = locked[msg.sender];
        // Validate inputs
        require(_value != 0, 'Only non zero amount');
        require(locked_.amount == 0, 'Lock exists');
        require(unlock_time >= locked_.end, 'Only increase lock end'); // from using quitLock, user should increaseAmount instead
        require(unlock_time > block.timestamp, 'Only future lock end');
        require(unlock_time <= block.timestamp + MAXTIME, 'Exceeds maxtime');
        // Update total supply of token deposited
        supply = supply + _value;
        // Update lock and voting power (checkpoint)
        // Casting in the next block is safe given that we check for _value>0 and the
        // totalSupply of tokens is generally significantly lower than the int128.max
        // value (considering the max precision of 18 decimals enforced in the constructor)
        locked_.amount = locked_.amount + int128(int256(_value));
        locked_.end = uint96(unlock_time);
        locked[msg.sender] = locked_;
        _checkpoint(msg.sender, LockedBalance(0, 0), locked_);
        emit Deposit(
            msg.sender,
            _value,
            unlock_time,
            LockAction.CREATE,
            block.timestamp
        );
    }

    /// @notice Creates a new lock for native token deposits
    /// @param _unlockTime Expiration time of the lock
    /// @dev The amount to lock is provided via `msg.value`
    /// `msg.value` is (unsafely) downcasted from `uint256` to `int128`
    /// and `_unlockTime` is (unsafely) downcasted from `uint256` to `uint96`
    /// assuming that the values never reach the respective max values
    function createLock(uint256 _unlockTime) external payable override {
        uint256 _value = msg.value;
        _createLock(_unlockTime, _value);
    }

    /// @notice Creates a new lock for wrapped token deposits
    /// @param _unlockTime Expiration time of the lock
    /// @param _value The amount to lock
    /// @dev The amount is transferred from WGNET, which needs to be approved first.
    function createLockWithWrappedToken(
        uint256 _unlockTime,
        uint256 _value
    ) external {
        wGNET.transferFrom(msg.sender, address(this), _value);
        wGNET.withdraw(_value);
        _createLock(_unlockTime, _value);
    }

    /// @notice Locks more tokens in an existing lock (internal function for processing either native or wrapped token)
    /// @param _value The amount to add
    /// @dev Assumes that the value is already checked and converted to the native token
    /// Does not update the lock's expiration
    /// Does record a new checkpoint for the lock
    /// `_value` is (unsafely) downcasted from `uint256` to `int128` assuming
    /// that the max value is never reached in practice
    function _increaseAmount(uint256 _value) internal nonReentrant {
        LockedBalance memory locked_ = locked[msg.sender];
        // Validate inputs
        require(_value != 0, 'Only non zero amount');
        require(locked_.amount > 0, 'No lock');
        require(locked_.end > block.timestamp, 'Lock expired');
        // Update total supply of token deposited
        supply = supply + _value;
        // Update lock
        uint256 unlockTime = locked_.end;
        LockAction action = LockAction.INCREASE_AMOUNT;
        LockedBalance memory newLocked;
        // Casting in the next block is safe given that we check for _value>0 and the
        // totalSupply of tokens is generally significantly lower than the int128.max
        // value (considering the max precision of 18 decimals enforced in the constructor)
        newLocked = _copyLock(locked_);
        newLocked.amount = newLocked.amount + int128(int256(_value));
        locked[msg.sender] = newLocked;
        _checkpoint(msg.sender, locked_, newLocked);
        // Native tokens are already received via msg.value
        emit Deposit(msg.sender, _value, unlockTime, action, block.timestamp);
    }

    /// @notice Locks more tokens in an existing lock for native token deposits
    /// @dev The amount to add is provided via `msg.value`
    /// Does not update the lock's expiration
    /// Does record a new checkpoint for the lock
    function increaseAmount() external payable override {
        uint256 _value = msg.value;
        _increaseAmount(_value);
    }

    /// @notice Locks more tokens in an existing lock for wrapped token deposits
    /// @param _value The amount to add
    /// @dev The amount is transferred from WGNET, which needs to be approved first.
    /// Does not update the lock's expiration
    /// Does record a new checkpoint for the lock
    function increaseAmountWithWrappedToken(uint256 _value) external {
        wGNET.transferFrom(msg.sender, address(this), _value);
        wGNET.withdraw(_value);
        _increaseAmount(_value);
    }

    /// @notice Extends the expiration of an existing lock
    /// @param _unlockTime New lock expiration time
    /// @dev Does not update the amount of tokens locked
    /// Does record a new checkpoint for the lock
    /// `_unlockTime` is (unsafely) downcasted from `uint256` to `uint96`
    /// assuming that the max value is never reached in practice
    function increaseUnlockTime(
        uint256 _unlockTime
    ) external override nonReentrant {
        LockedBalance memory locked_ = locked[msg.sender];
        uint256 unlock_time = _floorToWeek(_unlockTime); // Locktime is rounded down to weeks
        // Validate inputs
        require(locked_.amount > 0, 'No lock');
        require(locked_.end > block.timestamp, 'Lock expired');
        require(unlock_time > locked_.end, 'Only increase lock end');
        require(unlock_time <= block.timestamp + MAXTIME, 'Exceeds maxtime');
        // Update lock
        uint256 oldUnlockTime = locked_.end;
        locked_.end = uint96(unlock_time);
        locked[msg.sender] = locked_;
        if (locked_.amount > 0) {
            // Lock with non-zero virtual balance
            LockedBalance memory oldLocked = _copyLock(locked_);
            oldLocked.end = uint96(oldUnlockTime);
            _checkpoint(msg.sender, oldLocked, locked_);
        }
        emit Deposit(
            msg.sender,
            0,
            unlock_time,
            LockAction.INCREASE_TIME,
            block.timestamp
        );
    }

    /// @notice Withdraws the tokens of an expired lock
    /// @dev Internal function for processing either native or wrapped token
    /// @return payout The amount of tokens to be sent back to the user
    function _withdraw() internal nonReentrant returns (uint256 payout) {
        LockedBalance memory locked_ = locked[msg.sender];
        // Validate inputs
        require(locked_.amount > 0, 'No lock');
        require(locked_.end <= block.timestamp, 'Lock not expired');
        // Update total supply of token deposited
        uint256 value = uint256(uint128(locked_.amount));
        supply = supply - value;
        // Update lock
        LockedBalance memory newLocked = _copyLock(locked_);
        newLocked.amount = 0;
        newLocked.end = 0;
        locked[msg.sender] = newLocked;
        // oldLocked can have either expired <= timestamp or zero end
        // currentLock has only 0 end
        // Both can have >= 0 amount
        _checkpoint(msg.sender, locked_, newLocked);
        payout = value;
        emit Withdraw(msg.sender, payout, LockAction.WITHDRAW, block.timestamp);
    }

    /// @notice Withdraws native tokens of an expired lock
    function withdraw() external override {
        uint256 payout = _withdraw();
        // Send back deposited tokens
        payable(msg.sender).transfer(payout);
    }

    /// @notice Withdraws the tokens of an expired lock as wrapped token
    function withdrawWrappedToken() external {
        uint256 payout = _withdraw();
        // Send back deposited tokens
        wGNET.deposit{value: payout}();
        wGNET.transfer(msg.sender, payout);
    }

    /// ~~~~~~~~~~~~~~~~~~~~~~~~~~ ///
    ///         QUIT LOCK          ///
    /// ~~~~~~~~~~~~~~~~~~~~~~~~~~ ///

    /// @notice Quit an existing lock by withdrawing all tokens less a penalty
    /// @dev Internal function for processing either native or wrapped token
    /// Use `withdraw` for expired locks
    function _quitLock() internal nonReentrant returns (uint256 payout) {
        LockedBalance memory locked_ = locked[msg.sender];
        // Validate inputs
        require(locked_.amount > 0, 'No lock');
        require(locked_.end > block.timestamp, 'Lock expired');
        // Update total supply of token deposited
        uint256 value = uint256(uint128(locked_.amount));
        supply = supply - value;
        // Update lock
        LockedBalance memory newLocked = _copyLock(locked_);
        newLocked.amount = 0;
        locked[msg.sender] = newLocked;
        newLocked.end = 0;
        // oldLocked can have either expired <= timestamp or zero end
        // currentLock has only 0 end
        // Both can have >= 0 amount
        _checkpoint(msg.sender, locked_, newLocked);
        // apply penalty
        uint256 penaltyRate = _calculatePenaltyRate(locked_.end);
        uint256 penaltyAmount = (value * penaltyRate) / 1e18; // quitlock_penalty is in 18 decimals precision
        penaltyAccumulated = penaltyAccumulated + penaltyAmount;
        uint256 remainingAmount = value - penaltyAmount;
        emit Withdraw(msg.sender, value, LockAction.QUIT, block.timestamp);
        payout = remainingAmount;
    }

    /// @notice Quit an existing lock by withdrawing all tokens less a penalty
    /// @dev The payout is returned in native tokens
    /// Use `withdraw` for expired locks
    function quitLock() external override {
        uint256 payout = _quitLock();
        // Send back remaining tokens
        payable(msg.sender).transfer(payout);
    }

    /// @notice Quit an existing lock by withdrawing all tokens less a penalty
    /// @dev The payout is returned in wrapped tokens
    /// Use `withdraw` for expired locks
    function quitLockWrappedToken() external {
        uint256 payout = _quitLock();
        // Send back remaining tokens
        wGNET.deposit{value: payout}();
        wGNET.transfer(msg.sender, payout);
    }

    /// @notice Returns the penalty rate for a given lock expiration
    /// @param end The lock's expiration
    /// @return The penalty rate applicable to the lock
    /// @dev The penalty rate decreases linearly at the same rate as a lock's voting power
    /// in order to compensate for votes unlocked without committing to the lock expiration
    function getPenaltyRate(uint256 end) external view returns (uint256) {
        return _calculatePenaltyRate(end);
    }

    // Calculate penalty rate
    // Penalty rate decreases linearly at the same rate as a lock's voting power
    // in order to compensate for votes used
    function _calculatePenaltyRate(
        uint256 end
    ) internal view returns (uint256) {
        // We know that end > block.timestamp because expired locks cannot be quitted
        return ((end - block.timestamp) * maxPenalty) / MAXTIME;
    }

    /// @notice Collect accumulated penalty from lock quitters
    /// Everyone can collect but penalty is sent to `penaltyRecipient`
    function collectPenalty() external {
        uint256 amount = penaltyAccumulated;
        penaltyAccumulated = 0;
        address recipient = penaltyRecipient;
        payable(recipient).transfer(amount);
        emit CollectPenalty(amount, recipient);
    }

    /// ~~~~~~~~~~~~~~~~~~~~~~~~~~ ///
    ///            GETTERS         ///
    /// ~~~~~~~~~~~~~~~~~~~~~~~~~~ ///

    // Creates a copy of a lock
    function _copyLock(
        LockedBalance memory _locked
    ) internal pure returns (LockedBalance memory) {
        return LockedBalance({amount: _locked.amount, end: _locked.end});
    }

    // Floors a timestamp to the nearest weekly increment
    function _floorToWeek(uint256 _t) internal pure returns (uint256) {
        return (_t / WEEK) * WEEK;
    }

    // Uses binarysearch to find the most recent point history preceeding block
    // Find the most recent point history before _block
    // Do not search pointHistories past _maxEpoch
    function _findBlockEpoch(
        uint256 _block,
        uint256 _maxEpoch
    ) internal view returns (uint256) {
        // Binary search
        uint256 min = 0;
        uint256 max = _maxEpoch;
        // Will be always enough for 128-bit numbers
        for (uint256 i; i < 128; ) {
            if (min >= max) break;
            uint256 mid = (min + max + 1) / 2;
            if (pointHistory[mid].blk <= _block) {
                min = mid;
            } else {
                max = mid - 1;
            }
            unchecked {
                ++i;
            }
        }
        return min;
    }

    // Uses binarysearch to find the most recent user point history preceeding block
    // _addr is the lock owner for which to search
    // Find the most recent point history before _block
    function _findUserBlockEpoch(
        address _addr,
        uint256 _block
    ) internal view returns (uint256) {
        uint256 min = 0;
        uint256 max = userPointEpoch[_addr];
        for (uint256 i; i < 128; ) {
            if (min >= max) {
                break;
            }
            uint256 mid = (min + max + 1) / 2;
            if (userPointHistory[_addr][mid].blk <= _block) {
                min = mid;
            } else {
                max = mid - 1;
            }
            unchecked {
                ++i;
            }
        }
        return min;
    }

    /// @notice Get a lock's current voting power
    /// @param _owner The address of the lock owner for which to return voting power
    /// @return Voting power of the lock
    function balanceOf(address _owner) public view override returns (uint256) {
        uint256 epoch = userPointEpoch[_owner];
        if (epoch == 0) {
            return 0;
        }
        // Casting is safe given that checkpoints are recorded in the past
        // and are more frequent than every int128.max seconds
        Point memory lastPoint = userPointHistory[_owner][epoch];
        lastPoint.bias =
            lastPoint.bias -
            (lastPoint.slope * int128(int256(block.timestamp - lastPoint.ts)));
        if (lastPoint.bias < 0) {
            lastPoint.bias = 0;
        }
        return uint256(uint128(lastPoint.bias));
    }

    /// @notice Get a lock's voting power at a given block number
    /// @param _owner The address of the lock owner for which to return voting power
    /// @param _blockNumber The block at which to calculate the lock's voting power
    /// @return uint256 Voting power of the lock
    function balanceOfAt(
        address _owner,
        uint256 _blockNumber
    ) public view override returns (uint256) {
        require(_blockNumber <= block.number, 'Only past block number');

        // Get most recent user Point to block
        uint256 userEpoch = _findUserBlockEpoch(_owner, _blockNumber);
        if (userEpoch == 0) {
            return 0;
        }
        Point memory upoint = userPointHistory[_owner][userEpoch];

        // Get most recent global Point to block
        uint256 maxEpoch = globalEpoch;
        uint256 epoch = _findBlockEpoch(_blockNumber, maxEpoch);
        Point memory point0 = pointHistory[epoch];

        // Calculate delta (block & time) between user Point and target block
        // Allowing us to calculate the average seconds per block between
        // the two points
        uint256 dBlock = 0;
        uint256 dTime = 0;
        if (epoch < maxEpoch) {
            Point memory point1 = pointHistory[epoch + 1];
            dBlock = point1.blk - point0.blk;
            dTime = point1.ts - point0.ts;
        } else {
            dBlock = block.number - point0.blk;
            dTime = block.timestamp - point0.ts;
        }
        // (Deterministically) Estimate the time at which block _blockNumber was mined
        uint256 blockTime = point0.ts;
        if (dBlock != 0) {
            blockTime =
                blockTime +
                ((dTime * (_blockNumber - point0.blk)) / dBlock);
        }
        // Current Bias = most recent bias - (slope * time since update)
        // Casting is safe given that checkpoints are recorded in the past
        // and are more frequent than every int128.max seconds
        upoint.bias =
            upoint.bias -
            (upoint.slope * int128(int256(blockTime - upoint.ts)));
        if (upoint.bias >= 0) {
            return uint256(uint128(upoint.bias));
        } else {
            return 0;
        }
    }

    // Calculate total supply of voting power at a given time _t
    // _point is the most recent point before time _t
    // _t is the time at which to calculate supply
    function _supplyAt(
        Point memory _point,
        uint256 _t
    ) internal view returns (uint256) {
        Point memory lastPoint = _point;
        // Floor the timestamp to weekly interval
        uint256 iterativeTime = _floorToWeek(lastPoint.ts);
        // Iterate through all weeks between _point & _t to account for slope changes
        for (uint256 i; i < 255; ) {
            iterativeTime = iterativeTime + WEEK;
            int128 dSlope = 0;
            // If week end is after timestamp, then truncate & leave dSlope to 0
            if (iterativeTime > _t) {
                iterativeTime = _t;
            }
            // else get most recent slope change
            else {
                dSlope = slopeChanges[iterativeTime];
            }

            // Casting is safe given that lastPoint.ts < iterativeTime and
            // iteration goes over 255 weeks max
            lastPoint.bias =
                lastPoint.bias -
                (lastPoint.slope *
                    int128(int256(iterativeTime - lastPoint.ts)));
            if (iterativeTime == _t) {
                break;
            }
            lastPoint.slope = lastPoint.slope + dSlope;
            lastPoint.ts = iterativeTime;

            unchecked {
                ++i;
            }
        }

        if (lastPoint.bias < 0) {
            lastPoint.bias = 0;
        }
        return uint256(uint128(lastPoint.bias));
    }

    /// @notice Calculate current total supply of voting power
    /// @return Current totalSupply
    function totalSupply() public view override returns (uint256) {
        uint256 epoch_ = globalEpoch;
        Point memory lastPoint = pointHistory[epoch_];
        return _supplyAt(lastPoint, block.timestamp);
    }

    /// @notice Calculate total supply of voting power at a given block number
    /// @param _blockNumber The block number at which to calculate total supply
    /// @return totalSupply of voting power at the given block number
    function totalSupplyAt(
        uint256 _blockNumber
    ) public view override returns (uint256) {
        require(_blockNumber <= block.number, 'Only past block number');

        uint256 epoch = globalEpoch;
        uint256 targetEpoch = _findBlockEpoch(_blockNumber, epoch);

        Point memory point = pointHistory[targetEpoch];

        // If point.blk > _blockNumber that means we got the initial epoch & contract did not yet exist
        if (point.blk > _blockNumber) {
            return 0;
        }

        uint256 dTime = 0;
        if (targetEpoch < epoch) {
            Point memory pointNext = pointHistory[targetEpoch + 1];
            if (point.blk != pointNext.blk) {
                dTime =
                    ((_blockNumber - point.blk) * (pointNext.ts - point.ts)) /
                    (pointNext.blk - point.blk);
            }
        } else if (point.blk != block.number) {
            dTime =
                ((_blockNumber - point.blk) * (block.timestamp - point.ts)) /
                (block.number - point.blk);
        }
        // Now dTime contains info on how far are we beyond point
        return _supplyAt(point, point.ts + dTime);
    }
}
