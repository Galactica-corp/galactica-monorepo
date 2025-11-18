// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.28;

interface IVotingEscrow {
    function createLock(uint256 _unlockTime) external payable;

    function increaseAmount() external payable;

    function increaseUnlockTime(uint256 _unlockTime) external;

    function withdraw() external;

    function delegate(address _addr) external;

    function quitLock() external;

    function balanceOf(address _owner) external view returns (uint256);

    function balanceOfAt(
        address _owner,
        uint256 _blockNumber
    ) external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function totalSupplyAt(
        uint256 _blockNumber
    ) external view returns (uint256);
}
