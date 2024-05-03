// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.7;
pragma abicoder v2;

/// @author Galactica dev team
import {ZkCertificateRegistry} from '../ZkCertificateRegistry.sol';

contract ZkCertificateRegistryTest is ZkCertificateRegistry {
    constructor(
        address GuardianRegistry,
        uint256 treeDepth
    ) ZkCertificateRegistry(GuardianRegistry, treeDepth, 'Test Registry') {}

    function doubleInit(address GuardianRegistry, uint256 treeDepth) external {
        ZkCertificateRegistry.initializeZkCertificateRegistry(
            GuardianRegistry,
            treeDepth,
            'Test Registry'
        );
    }

    function initializeZkCertificateRegistryTest(
        address GuardianRegistry,
        uint256 treeDepth
    ) internal initializer {
        ZkCertificateRegistry.initializeZkCertificateRegistry(
            GuardianRegistry,
            treeDepth,
            'Test Registry'
        );
    }
}
