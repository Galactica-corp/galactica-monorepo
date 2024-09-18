// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "./Ownable.sol";
import "./interfaces/ITwitterZkCertificateVerifier.sol";
import "./interfaces/IZkCertificateRegistry.sol";

/// @author Galactica dev team
/// @title a wrapper for verifier of twitter creation time proof
contract TwitterCreationTimeProof is Ownable {
    ITwitterZkCertificateVerifier public verifier;
    IZkCertificateRegistry public registry;
    uint256 public constant timeDifferenceTolerance = 30*60; // the maximal difference between the onchain time and public input current time

    // indices of the ZKP public input array
    uint8 public immutable INDEX_IS_VALID;
    uint8 public immutable INDEX_VERIFICATION_EXPIRATION;
    uint8 public immutable INDEX_ROOT;
    uint8 public immutable INDEX_CURRENT_TIME;
    uint8 public immutable INDEX_USER_ADDRESS;
    uint8 public immutable INDEX_PROVIDER_PUBKEY_AX;
    uint8 public immutable INDEX_PROVIDER_PUBKEY_AY;

    uint8 public immutable INDEX_CREATION_TIME_LOWER_BOUND;
    uint8 public immutable INDEX_CREATION_TIME_UPPER_BOUND;

    constructor(
        address _owner,
        address _verifier,
        address _registry
    ) Ownable(_owner) {
        verifier = ITwitterZkCertificateVerifier(_verifier);
        registry = IZkCertificateRegistry(_registry);

        // public outputs of the circuit
        INDEX_IS_VALID = 0;
        INDEX_VERIFICATION_EXPIRATION = 1;

        // public inputs that need to be checked onchain
        INDEX_ROOT = 2;
        INDEX_CURRENT_TIME = 3;
        INDEX_USER_ADDRESS = 4;
        INDEX_PROVIDER_PUBKEY_AX = 5;
        INDEX_PROVIDER_PUBKEY_AY = 6;
        INDEX_CREATION_TIME_LOWER_BOUND = 7;
        INDEX_CREATION_TIME_UPPER_BOUND = 8;
    }

    function setVerifier(ITwitterZkCertificateVerifier newVerifier) public onlyOwner {
        verifier = newVerifier;
    }

    function setRegistry(IZkCertificateRegistry newRegistry) public onlyOwner {
        registry = newRegistry;
    }

    //a, b, c are the proof
    // input array contains the public parameters: isValid, verificationExpirationTime, merkleRoot, currentTime, userAddress, providerPubKeyA, providerPubKeyB
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[] memory input
    ) public view returns (bool) {
        require(
            input.length == 8,
            "the public proof input has an incorrect length"
        );
        require(input[INDEX_IS_VALID] == 1, "the proof output is not valid");

        bytes32 proofRoot = bytes32(input[INDEX_ROOT]);
        require(
          registry.verifyMerkleRoot(proofRoot),
          "invalid merkle root"
        );

        uint proofCurrentTime = input[INDEX_CURRENT_TIME];
        uint timeDiff;
        if (proofCurrentTime > block.timestamp) {
            timeDiff = proofCurrentTime - block.timestamp;
        } else {
            timeDiff = block.timestamp - proofCurrentTime;
        }
        require(
            timeDiff <= timeDifferenceTolerance,
            "the current time is incorrect"
        );

        // dev note: if we ever use proof hash, make sure to pay attention to this truncation to uint160 as it can violate uniqueness
        require(
            tx.origin == address(uint160(input[INDEX_USER_ADDRESS])),
            "transaction submitter is not authorized to use this proof"
        );

        require(verifier.verifyProof(a, b, c, input), "the proof is incorrect");
        return true;
    }
}


