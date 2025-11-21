// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {IVotingEscrow} from '../interfaces/IVotingEscrow.sol';

contract MockSmartWallet {
    receive() external payable {}

    function createLock(address ve, uint256 end, uint256 value) external {
        IVotingEscrow(ve).createLock{value: value}(end);
    }

    function increaseAmount(address ve, uint256 value) external {
        IVotingEscrow(ve).increaseAmount{value: value}();
    }

    function increaseUnlockTime(address ve, uint256 unlockTime) external {
        IVotingEscrow(ve).increaseUnlockTime(unlockTime);
    }

    function quitLock(address ve) external {
        IVotingEscrow(ve).quitLock();
    }

    function withdraw(address ve) external {
        IVotingEscrow(ve).withdraw();
    }

    function delegate(address ve, address to) external {
        IVotingEscrow(ve).delegate(to);
    }
}
