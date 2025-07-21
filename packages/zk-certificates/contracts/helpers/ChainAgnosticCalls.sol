// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface ArbSys {
    /**
     * @notice Get Arbitrum block number (distinct from L1 block number; Arbitrum genesis block has block number 0)
     * @return block number as int
     */
    function arbBlockNumber() external view returns (uint);
}

/**
 * @title ChainAgnosticCalls
 * @notice This contract is used to make calls that depend on the underlying chain.
 */
contract ChainAgnosticCalls {
    /**
     * @notice Get the block number
     * @dev On Arbitrum, we need to use the ArbSys contract to get the block number of the L2 instead of the L1.
     * @return blockNumber The block number
     */
    function getBlockNumber() public view returns (uint256 blockNumber) {
        if (
            block.chainid == 42161 || // Arbitrum One
            block.chainid == 421614 || // Arbitrum Nova
            block.chainid == 42170 || // Arbitrum Sepolia
            block.chainid == 843843 // Galactica Cassiopeia
        ) {
            blockNumber = ArbSys(address(100)).arbBlockNumber();
        } else {
            // For most other chains (ETH, L1s, local chains, etc.) we can just use the block.number
            blockNumber = block.number;
        }
    }

    /**
     * @notice Get the block number of the L1
     * @return l1BlockNumber The block number
     */
    function getL1BlockNumber() public view returns (uint256 l1BlockNumber) {
        l1BlockNumber = block.number;
    }
}
