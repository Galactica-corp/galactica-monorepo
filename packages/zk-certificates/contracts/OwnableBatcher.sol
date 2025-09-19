// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '@openzeppelin/contracts/access/Ownable.sol';

/// @title OwnableBatcher
/// @notice A simple contract that allows the owner to batch multiple transactions
/// @dev Uses the same Call struct as Multicall3
contract OwnableBatcher is Ownable {
    struct Call {
        address target;
        bytes callData;
    }

    constructor() Ownable(msg.sender) {}

    /// @notice Batch multiple calls, only callable by the owner
    /// @param calls An array of Call structs to execute
    /// @return returnData An array of bytes containing the responses
    function batchCalls(
        Call[] calldata calls
    ) external onlyOwner returns (bytes[] memory returnData) {
        uint256 length = calls.length;
        returnData = new bytes[](length);

        for (uint256 i = 0; i < length; ) {
            Call calldata call = calls[i];
            (bool success, bytes memory result) = call.target.call(
                call.callData
            );

            if (!success) {
                // If any call fails, revert with the error data
                assembly {
                    let returndata_size := mload(result)
                    revert(add(32, result), returndata_size)
                }
            }

            returnData[i] = result;

            unchecked {
                ++i;
            }
        }
    }

    /// @notice Emergency function to withdraw any ETH stuck in the contract
    /// @dev Only callable by the owner
    function withdrawETH() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}(
            ''
        );
        require(success, 'Withdrawal failed');
    }
}
