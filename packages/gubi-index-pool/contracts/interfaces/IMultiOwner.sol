// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/IAccessControl.sol";

/**
 * @title IMultiOwner
 * @notice Interface for the MultiOwner contract that allows a list of addresses to execute calls as the owner.
 */
interface IMultiOwner is IAccessControl {
    /**
     * @dev Emitted when an executor successfully executes a call.
     */
    event Executed(
        address indexed executor,
        address indexed target,
        bytes data,
        uint256 value
    );

    /**
     * @dev Emitted when ownership of a target contract is accepted.
     */
    event OwnershipAccepted(address indexed target);

    /**
     * @dev Returns the executor role identifier.
     */
    function EXECUTOR_ROLE() external view returns (bytes32);

    /**
     * @dev Executes a call to another contract. Restricted to executors.
     * @param target The address of the contract to call.
     * @param data The calldata to send to the target contract.
     * @param value The amount of Ether to send with the call.
     */
    function execute(address target, bytes memory data, uint256 value) external;

    /**
     * @dev Accepts ownership of an Ownable2Step contract. Restricted to executors.
     * @param target The address of the Ownable2Step contract to accept ownership of.
     */
    function acceptOwnershipOf(address target) external;

    /**
     * @dev Adds a new executor. Restricted to admins.
     * @param newExecutor The address to grant EXECUTOR_ROLE to.
     */
    function addExecutor(address newExecutor) external;

    /**
     * @dev Removes an executor. Restricted to admins.
     * @param executor The address to revoke EXECUTOR_ROLE from.
     */
    function removeExecutor(address executor) external;
}
