// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "./Ownable.sol";
import "./interfaces/IZkKYCVerifier.sol";
import "./interfaces/IKYCRegistry.sol";
import "./interfaces/IGalacticaInstitution.sol";

/// @author Galactica dev team
/// @title a wrapper for verifier of ZkKYC record existence
contract ZkKYC is Ownable {
    IZkKYCVerifier public verifier;
    IKYCRegistry public KYCRegistry;
    IGalacticaInstitution[] public fraudInvestigationInstitutions;
    uint256 public constant timeDifferenceTolerance = 120; // the maximal difference between the onchain time and public input current time

    // indices of the ZKP public input array
    uint8 public immutable INDEX_USER_PUBKEY_AX;
    uint8 public immutable INDEX_USER_PUBKEY_AY;
    uint8 public immutable INDEX_IS_VALID;
    uint8 public immutable INDEX_VERIFICATION_EXPIRATION;
    uint8 public immutable INDEX_ROOT;
    uint8 public immutable INDEX_CURRENT_TIME;
    uint8 public immutable INDEX_USER_ADDRESS;
    uint8 public immutable INDEX_HUMAN_ID;
    uint8 public immutable INDEX_DAPP_ID;
    uint8 public immutable INDEX_PROVIDER_PUBKEY_AX;
    uint8 public immutable INDEX_PROVIDER_PUBKEY_AY;

    uint8 public immutable START_INDEX_ENCRYPTED_DATA;
    uint8 public immutable START_INDEX_INVESTIGATION_INSTITUTIONS;

    constructor(
        address _owner,
        address _verifier,
        address _KYCRegistry,
        address[] memory _fraudInvestigationInstitutions
    ) Ownable(_owner) {
        verifier = IZkKYCVerifier(_verifier);
        KYCRegistry = IKYCRegistry(_KYCRegistry);
        for (uint i = 0; i < _fraudInvestigationInstitutions.length; i++) {
            fraudInvestigationInstitutions.push(
                IGalacticaInstitution(_fraudInvestigationInstitutions[i])
            );
        }

        // set public input indices according to the number of institutions
        INDEX_USER_PUBKEY_AX = 0;
        INDEX_USER_PUBKEY_AY = 1;
        INDEX_IS_VALID = 2;
        INDEX_VERIFICATION_EXPIRATION = 3;

        // for each institution there are two fields containing the encrypted data of the shamir shares
        START_INDEX_ENCRYPTED_DATA = 4;
        uint8 institutionKeyEntries = 2 *
            uint8(fraudInvestigationInstitutions.length);

        INDEX_ROOT = 4 + institutionKeyEntries;
        INDEX_CURRENT_TIME = 5 + institutionKeyEntries;
        INDEX_USER_ADDRESS = 6 + institutionKeyEntries;
        INDEX_HUMAN_ID = 7 + institutionKeyEntries;
        INDEX_DAPP_ID = 8 + institutionKeyEntries;
        INDEX_PROVIDER_PUBKEY_AX = 9 + institutionKeyEntries;
        INDEX_PROVIDER_PUBKEY_AY = 10 + institutionKeyEntries;

        // The following indices are for the fraud investigation institutions and depend on the number of institutions
        // It includes pubkeys ax and ay for each institution
        START_INDEX_INVESTIGATION_INSTITUTIONS = 11 + institutionKeyEntries;
    }

    function setVerifier(IZkKYCVerifier newVerifier) public onlyOwner {
        verifier = newVerifier;
    }

    function setKYCRegistry(IKYCRegistry newKYCRegistry) public onlyOwner {
        KYCRegistry = newKYCRegistry;
    }

    function setFraudInvestigationInstituions(
        IGalacticaInstitution[] calldata _fraudInvestigationInstitutions
    ) public onlyOwner {
        fraudInvestigationInstitutions = _fraudInvestigationInstitutions;
    }

    //a, b, c are the proof
    // input array contains the public parameters: isValid, root, currentTime
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[] memory input
    ) public view returns (bool) {
        require(
            input.length == 11 + 4 * fraudInvestigationInstitutions.length,
            "the public proof input has an incorrect length (also considering the amount of investigation institutions)"
        );
        require(input[INDEX_IS_VALID] == 1, "the proof output is not valid");

        bytes32 proofRoot = bytes32(input[INDEX_ROOT]);
        require(
            KYCRegistry.rootHistory(proofRoot),
            "the root in the proof doesn't match"
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

        // check that the institution public keys corresponds to the onchain ones;
        for (uint i = 0; i < fraudInvestigationInstitutions.length; i++) {
            require(
                fraudInvestigationInstitutions[i].institutionPubKey(0) ==
                    input[START_INDEX_INVESTIGATION_INSTITUTIONS + 2 * i],
                "the first part of institution pubkey is incorrect"
            );
            require(
                fraudInvestigationInstitutions[i].institutionPubKey(1) ==
                    input[START_INDEX_INVESTIGATION_INSTITUTIONS + 2 * i + 1],
                "the second part of institution pubkey is incorrect"
            );
        }

        require(verifier.verifyProof(a, b, c, input), "the proof is incorrect");
        return true;
    }

    function getAmountFraudInvestigationInstitutions()
        public
        view
        returns (uint)
    {
        return fraudInvestigationInstitutions.length;
    }
}
