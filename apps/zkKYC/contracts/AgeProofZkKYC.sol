// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "./Ownable.sol";
import "./interfaces/IAgeProofZkKYCVerifier.sol";
import "./interfaces/IKYCRegistry.sol";
import "./libraries/BokkyPooBahsDateTimeLibrary.sol";
import "./interfaces/IGalacticaInstitution.sol";
import "hardhat/console.sol";

/// @author Galactica dev team
/// @title A wrapper for verifier with age condition
contract AgeProofZkKYC is Ownable {
    IAgeProofZkKYCVerifier public verifier;
    IKYCRegistry public KYCRegistry;
    IGalacticaInstitution[] public fraudInvestigationInstitutions;
    uint256 public constant timeDifferenceTolerance = 120; // the maximal difference between the onchain time and public input current time

    // indices of the ZKP public input array
    uint8 public immutable INDEX_USER_PUBKEY_AX;
    uint8 public immutable INDEX_USER_PUBKEY_AY;
    uint8 public immutable INDEX_IS_VALID;
    uint8 public immutable INDEX_VERIFICATION_EXPIRATION;
    uint8 public immutable START_INDEX_ENCRYPTED_DATA;
    uint8 public immutable INDEX_ROOT;
    uint8 public immutable INDEX_CURRENT_TIME;
    uint8 public immutable INDEX_USER_ADDRESS;
    uint8 public immutable INDEX_CURRENT_YEAR;
    uint8 public immutable INDEX_CURRENT_MONTH;
    uint8 public immutable INDEX_CURRENT_DAY;
    uint8 public immutable INDEX_AGE_THRESHOLD;
    uint8 public immutable INDEX_HUMAN_ID;
    uint8 public immutable INDEX_DAPP_ID;
    uint8 public immutable INDEX_PROVIDER_PUBKEY_AX;
    uint8 public immutable INDEX_PROVIDER_PUBKEY_AY;
    uint8 public immutable START_INDEX_INVESTIGATION_INSTITUTIONS;

    constructor(
        address _owner,
        address _verifier,
        address _KYCRegistry,
        address[] memory _fraudInvestigationInstitutions
    ) Ownable(_owner) {
        verifier = IAgeProofZkKYCVerifier(_verifier);
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
        INDEX_CURRENT_YEAR = 7 + institutionKeyEntries;
        INDEX_CURRENT_MONTH = 8 + institutionKeyEntries;
        INDEX_CURRENT_DAY = 9 + institutionKeyEntries;
        INDEX_AGE_THRESHOLD = 10 + institutionKeyEntries;
        INDEX_HUMAN_ID = 11 + institutionKeyEntries;
        INDEX_DAPP_ID = 12 + institutionKeyEntries;
        INDEX_PROVIDER_PUBKEY_AX = 13 + institutionKeyEntries;
        INDEX_PROVIDER_PUBKEY_AY = 14 + institutionKeyEntries;

        // The following indices are for the fraud investigation institutions and depend on the number of institutions
        // It includes pubkeys ax and ay for each institution
        START_INDEX_INVESTIGATION_INSTITUTIONS = 15 + institutionKeyEntries;
    }

    function setVerifier(IAgeProofZkKYCVerifier newVerifier) public onlyOwner {
        verifier = newVerifier;
    }

    function setKYCRegistry(IKYCRegistry newKYCRegistry) public onlyOwner {
        KYCRegistry = newKYCRegistry;
    }

    function setGalacticaInstituion(
        IGalacticaInstitution[] calldata _fraudInvestigationInstitutions
    ) public onlyOwner {
        fraudInvestigationInstitutions = _fraudInvestigationInstitutions;
    }

    //a, b, c are the proof
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[] memory input
    ) public view returns (bool) {
        require(
            input.length == 15 + 4 * fraudInvestigationInstitutions.length,
            "the public proof input has an incorrect length (also considering the amount of investigation institutions)"
        );
        require(input[INDEX_IS_VALID] == 1, "the proof output is not valid");

        bytes32 proofRoot = bytes32(input[INDEX_ROOT]);
        require(
            KYCRegistry.rootHistory(proofRoot),
            "the root in the proof doesn't match"
        );

        uint proofCurrentTime = input[INDEX_CURRENT_TIME];
        uint onchainTime = block.timestamp;
        uint timeDiff;
        if (proofCurrentTime > onchainTime) {
            timeDiff = proofCurrentTime - onchainTime;
        } else {
            timeDiff = onchainTime - proofCurrentTime;
        }
        require(
            timeDiff <= timeDifferenceTolerance,
            "the current time is incorrect"
        );

        // tx.origin is used here so user doesn't need to submit proof directly to this SC but can also submit through dApp
        require(
            tx.origin == address(uint160(input[INDEX_USER_ADDRESS])),
            "transaction submitter is not authorized to use this proof"
        );

        (
            uint onchainYear,
            uint onchainMonth,
            uint onchainDay
        ) = BokkyPooBahsDateTimeLibrary.timestampToDate(onchainTime);

        require(
            onchainYear == input[INDEX_CURRENT_YEAR],
            "the current year is incorrect"
        );
        require(
            onchainMonth == input[INDEX_CURRENT_MONTH],
            "the current month is incorrect"
        );
        require(
            onchainDay == input[INDEX_CURRENT_DAY],
            "the current day is incorrect"
        );

        // check that the institution public key corresponds to the onchain one;
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
