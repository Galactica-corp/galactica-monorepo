// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.7;
pragma abicoder v2;

/// @author Galactica dev team
import {ZkCertificateRegistry} from '../ZkCertificateRegistry.sol';

contract ZkCertificateRegistryTest is ZkCertificateRegistry {
    constructor(address GuardianRegistry) ZkCertificateRegistry(GuardianRegistry, "Test Registry"){}

    function doubleInit(address GuardianRegistry) external {
        ZkCertificateRegistry.initializeZkCertificateRegistry(GuardianRegistry, "Test Registry");
    }

    function initializeZkCertificateRegistryTest(
        address GuardianRegistry
    ) internal initializer {
        ZkCertificateRegistry.initializeZkCertificateRegistry(GuardianRegistry, "Test Registry");
    }
}
