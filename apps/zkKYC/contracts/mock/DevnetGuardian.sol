// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.7;
pragma abicoder v2;

import {KYCRecordRegistry} from "../KYCRecordRegistry.sol";

/**
 * @title DevnetGuardian is a simple KYC guardian that everyone can use to issue zkKYCs on Devnet
 * @author Galactica dev team
 * @notice Works as interface to the KYCRecordRegistry providing a simple way to issue zkKYCs while being authorized as a guardian
 */
contract DevnetGuardian {
    KYCRecordRegistry public recordRegistry;

    constructor(address _recordRegistry) {
        recordRegistry = KYCRecordRegistry(_recordRegistry);
    }

    /**
     * @notice addZkKYCRecord issues a zkKYC record by adding it to the Merkle tree
     * @param zkKYCRecordLeafHash - hash of the zkKYC record leaf
     */
    function addZkKYCRecord(bytes32 zkKYCRecordLeafHash) public {
        recordRegistry.addZkKYCRecord(zkKYCRecordLeafHash);
    }

    /**
     * @notice Gets tree number that new zkKYC record will get inserted to
     * @param _newZkKYCRecords - number of new zkKYC records
     * @return treeNumber, startingIndex
     */
    function getInsertionTreeNumberAndStartingIndex(
        uint256 _newZkKYCRecords
    ) public view returns (uint256, uint256) {
        return
            recordRegistry.getInsertionTreeNumberAndStartingIndex(
                _newZkKYCRecords
            );
    }
}
