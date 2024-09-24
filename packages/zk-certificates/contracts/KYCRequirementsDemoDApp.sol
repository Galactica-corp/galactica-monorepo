// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;
import {VerificationSBT} from './SBT_related/VerificationSBT.sol';
import {IAgeCitizenshipKYCVerifier} from './interfaces/IAgeCitizenshipKYCVerifier.sol';

/**
 * @title KYCRequirementsDemoDApp
 * @author Galactica dev team
 * @notice An example DApp that requires a zkKYC proof to issue a Verification SBT.
 *  Registration can be repeated.
 *  The ZKPs check that:
 *  1. The user has a valid zkKYC.
 *  2. The user is at least 18 years old.
 *  3. The user is a non-US citizen.
 *  It does not have other disclosures and does not include fraud investigation.
 */
contract KYCRequirementsDemoDApp {
    VerificationSBT public SBT;
    IAgeCitizenshipKYCVerifier public verifierWrapper;

    constructor(
        VerificationSBT _SBT,
        IAgeCitizenshipKYCVerifier _verifierWrapper
    ) {
        SBT = _SBT;
        verifierWrapper = _verifierWrapper;
    }

    /**
     * @notice passedRequirements checks if an address provided a valid ZKP and got a verification SBT
     * @param account the address to check
     */
    function passedRequirements(address account) public view returns (bool) {
        return SBT.isVerificationSBTValid(account, address(this));
    }

    function checkRequirements(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[] memory input
    ) public {
        bytes32 humanID = bytes32(input[verifierWrapper.INDEX_HUMAN_ID()]);
        uint dAppAddress = input[verifierWrapper.INDEX_DAPP_ID()];

        // check that the public dAppAddress is correct
        require(
            dAppAddress == uint(uint160(address(this))),
            'incorrect dAppAddress'
        );

        // check the zk proof
        require(verifierWrapper.verifyProof(a, b, c, input), 'invalid proof');

        //afterwards we mint the verification SBT
        uint expirationTime = input[
            verifierWrapper.INDEX_VERIFICATION_EXPIRATION()
        ];
        uint256[2] memory providerPubKey = [
            input[verifierWrapper.INDEX_PROVIDER_PUBKEY_AX()],
            input[verifierWrapper.INDEX_PROVIDER_PUBKEY_AY()]
        ];
        uint256[2] memory userPubKey = [
            input[verifierWrapper.INDEX_USER_PUBKEY_AX()],
            input[verifierWrapper.INDEX_USER_PUBKEY_AY()]
        ];
        bytes32[] memory noEncryptedData;
        SBT.mintVerificationSBT(
            msg.sender,
            verifierWrapper,
            expirationTime,
            noEncryptedData,
            userPubKey,
            humanID,
            providerPubKey
        );
    }

    /**
     * @notice For demo purposes, the verification status of a user can be reset by replacing the verificationSBT with an invalid one.
     * @dev This function is only for demo purposes and should not be used in production.
     */
    function resetVerification() external {
        bytes32[] memory noEncryptedData;
        SBT.mintVerificationSBT(
            msg.sender,
            verifierWrapper,
            0, // expired
            noEncryptedData,
            [uint(0), uint(0)],
            0,
            [uint(0), uint(0)]
        );
    }
}
