// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import {Ownable} from '../Ownable.sol';
import {IAgeCitizenshipKYCVerifier} from '../interfaces/IAgeCitizenshipKYCVerifier.sol';
import {IVerifierWrapper} from '../interfaces/IVerifierWrapper.sol';
import {IZkCertificateRegistry} from '../interfaces/IZkCertificateRegistry.sol';
import {BokkyPooBahsDateTimeLibrary} from '../libraries/BokkyPooBahsDateTimeLibrary.sol';
import {IGalacticaInstitution} from '../interfaces/IGalacticaInstitution.sol';
import {ICircomVerifier} from '../interfaces/ICircomVerifier.sol';
import {IGuardianRegistry} from '../interfaces/IGuardianRegistry.sol';

/**
 * @title Smart contract demo for Galactica zkKYC requirements
 * @dev This contract is requires the user to 1. hold a valid zkKYC, 2. be above a certain age, and 3. be a citizen of a non-sanctioned country
 * @author Galactica Network
 */
contract AgeCitizenshipKYC is Ownable, IAgeCitizenshipKYCVerifier {
    ICircomVerifier public verifier;
    IZkCertificateRegistry public KYCRegistry;
    // list of sanctioned countries. Each entry is a poseidon hash of the Alpha-3 country code as field element so we can compare it with the public input of the circom proof.
    uint[] public sanctionedCountries;
    IGalacticaInstitution[] public fraudInvestigationInstitutions;
    uint256 public constant timeDifferenceTolerance = 30 * 60; // the maximal difference between the onchain time and public input current time
    // the age threshold a user has to have at least to pass the KYC check
    uint256 public ageThreshold;

    // indices of the ZKP public input array
    uint8 public immutable INDEX_USER_PUBKEY_AX;
    uint8 public immutable INDEX_USER_PUBKEY_AY;
    uint8 public immutable INDEX_IS_VALID;
    uint8 public immutable INDEX_ERROR;
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
    uint8 public immutable START_INDEX_COUNTRY_EXCLUSTIONS;

    constructor(
        address _owner,
        address _verifier,
        address _KYCRegistry,
        uint[] memory _sanctionedCountries,
        address[] memory _fraudInvestigationInstitutions,
        uint _ageThreshold
    ) Ownable(_owner) {
        verifier = ICircomVerifier(_verifier);
        KYCRegistry = IZkCertificateRegistry(_KYCRegistry);
        for (uint i = 0; i < _sanctionedCountries.length; i++) {
            sanctionedCountries.push(_sanctionedCountries[i]);
        }
        for (uint i = 0; i < _fraudInvestigationInstitutions.length; i++) {
            fraudInvestigationInstitutions.push(
                IGalacticaInstitution(_fraudInvestigationInstitutions[i])
            );
        }
        ageThreshold = _ageThreshold;

        // set public input indices according to the number of institutions
        INDEX_HUMAN_ID = 0;
        INDEX_USER_PUBKEY_AX = 1;
        INDEX_USER_PUBKEY_AY = 2;
        INDEX_IS_VALID = 3;
        INDEX_ERROR = 4;
        INDEX_VERIFICATION_EXPIRATION = 5;

        // for each institution there are two fields containing the encrypted data of the shamir shares
        START_INDEX_ENCRYPTED_DATA = 6;
        uint8 institutionKeyEntries = 2 *
            uint8(fraudInvestigationInstitutions.length);

        INDEX_ROOT = 6 + institutionKeyEntries;
        INDEX_CURRENT_TIME = 7 + institutionKeyEntries;
        INDEX_USER_ADDRESS = 8 + institutionKeyEntries;
        INDEX_CURRENT_YEAR = 9 + institutionKeyEntries;
        INDEX_CURRENT_MONTH = 10 + institutionKeyEntries;
        INDEX_CURRENT_DAY = 11 + institutionKeyEntries;
        INDEX_AGE_THRESHOLD = 12 + institutionKeyEntries;
        START_INDEX_COUNTRY_EXCLUSTIONS = 13 + institutionKeyEntries;
        INDEX_DAPP_ID =
            13 +
            institutionKeyEntries +
            uint8(sanctionedCountries.length);
        INDEX_PROVIDER_PUBKEY_AX =
            14 +
            institutionKeyEntries +
            uint8(sanctionedCountries.length);
        INDEX_PROVIDER_PUBKEY_AY =
            15 +
            institutionKeyEntries +
            uint8(sanctionedCountries.length);

        // The following indices are for the fraud investigation institutions and depend on the number of institutions
        // It includes pubkeys ax and ay for each institution
        START_INDEX_INVESTIGATION_INSTITUTIONS =
            16 +
            institutionKeyEntries +
            uint8(sanctionedCountries.length);
    }

    function setVerifier(ICircomVerifier newVerifier) public onlyOwner {
        verifier = newVerifier;
    }

    function setKYCRegistry(
        IZkCertificateRegistry newKYCRegistry
    ) public onlyOwner {
        KYCRegistry = newKYCRegistry;
    }

    function setGalacticaInstituion(
        IGalacticaInstitution[] calldata _fraudInvestigationInstitutions
    ) public onlyOwner {
        fraudInvestigationInstitutions = _fraudInvestigationInstitutions;
    }

    function setSanctionedCountries(
        uint[] calldata _sanctionedCountries
    ) public onlyOwner {
        // check that the new list has the same length as the old one to keep the proof input array indices consistent
        // could be made flexible if needed
        require(
            _sanctionedCountries.length == sanctionedCountries.length,
            'sanction list needs to be the same length'
        );
        sanctionedCountries = _sanctionedCountries;
    }

    /**
     * @notice set the age threshold for the KYC check.
     * @param _ageTreshold - The new age threshold.
     */
    function setAgeThreshold(uint _ageTreshold) public onlyOwner {
        ageThreshold = _ageTreshold;
    }

    //a, b, c are the proof
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[] memory input
    ) public view returns (bool) {
        require(
            input.length ==
                16 +
                    4 *
                    fraudInvestigationInstitutions.length +
                    sanctionedCountries.length,
            'the public proof input has an incorrect length (also considering the amount of investigation institutions)'
        );
        require(input[INDEX_IS_VALID] == 1, 'the proof output is not valid');
        require(input[INDEX_ERROR] == 0, 'the proof output contains an error');

        bytes32 proofRoot = bytes32(input[INDEX_ROOT]);
        require(KYCRegistry.verifyMerkleRoot(proofRoot), 'invalid merkle root');

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
            'the current time is incorrect'
        );

        // tx.origin is used here so user doesn't need to submit proof directly to this SC but can also submit through dApp
        require(
            tx.origin == address(uint160(input[INDEX_USER_ADDRESS])),
            'transaction submitter is not authorized to use this proof'
        );

        (
            uint onchainYear,
            uint onchainMonth,
            uint onchainDay
        ) = BokkyPooBahsDateTimeLibrary.timestampToDate(onchainTime);

        require(
            onchainYear == input[INDEX_CURRENT_YEAR],
            'the current year is incorrect'
        );
        require(
            onchainMonth == input[INDEX_CURRENT_MONTH],
            'the current month is incorrect'
        );
        require(
            onchainDay == input[INDEX_CURRENT_DAY],
            'the current day is incorrect'
        );

        for (uint i = 0; i < sanctionedCountries.length; i++) {
            require(
                sanctionedCountries[i] ==
                    input[START_INDEX_COUNTRY_EXCLUSTIONS + i],
                'the country sanction list differs'
            );
        }

        require(
            input[INDEX_AGE_THRESHOLD] >= ageThreshold,
            'the age threshold is not proven'
        );

        // check that the pubkey belongs to a whitelisted provider
        IGuardianRegistry guardianRegistry = KYCRegistry._GuardianRegistry();
        address guardianAddress = guardianRegistry.pubKeyToAddress(
            input[INDEX_PROVIDER_PUBKEY_AX],
            input[INDEX_PROVIDER_PUBKEY_AY]
        );
        require(
            guardianRegistry.isWhitelisted(guardianAddress),
            'the provider is not whitelisted'
        );

        // check that the institution public key corresponds to the onchain one;
        for (uint i = 0; i < fraudInvestigationInstitutions.length; i++) {
            require(
                fraudInvestigationInstitutions[i].institutionPubKey(0) ==
                    input[START_INDEX_INVESTIGATION_INSTITUTIONS + 2 * i],
                'the first part of institution pubkey is incorrect'
            );
            require(
                fraudInvestigationInstitutions[i].institutionPubKey(1) ==
                    input[START_INDEX_INVESTIGATION_INSTITUTIONS + 2 * i + 1],
                'the second part of institution pubkey is incorrect'
            );
        }

        require(verifier.verifyProof(a, b, c, input), 'the proof is incorrect');
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
