// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;
import {VerificationSBT} from '../SBT_related/VerificationSBT.sol';
import {IAgeCitizenshipKYCVerifier} from '../interfaces/IAgeCitizenshipKYCVerifier.sol';
import {IVerificationSBT} from '../interfaces/IVerificationSBT.sol';
import {IVerificationSBTIssuer} from '../interfaces/IVerificationSBTIssuer.sol';

/**
 * @title KYCRequirementsDemoDApp
 * @author Galactica dev team
 * @notice An example DApp that requires a zkKYC proof to issue a Verification SBT.
 *  Registration can be repeated.
 *  The requirements of the ZKP (i.e. age, citizenship, etc.) are defined in the verifierWrapper.
 *  This demo DApp does not include fraud investigation features.
 */
contract KYCRequirementsDemoDApp is IVerificationSBTIssuer {
    IVerificationSBT public sbt;
    IAgeCitizenshipKYCVerifier public verifierWrapper;

    constructor(
        IAgeCitizenshipKYCVerifier _verifierWrapper,
        string memory _sbt_uri,
        string memory _sbt_name,
        string memory _sbt_symbol
    ) {
        sbt = new VerificationSBT(
            _sbt_uri,
            _sbt_name,
            _sbt_symbol,
            address(this)
        );
        verifierWrapper = _verifierWrapper;
    }

    /**
     * @notice passedRequirements checks if an address provided a valid ZKP and got a verification SBT
     * @param account the address to check
     */
    function passedRequirements(address account) public view returns (bool) {
        return sbt.isVerificationSBTValid(account);
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
        sbt.mintVerificationSBT(
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
        sbt.mintVerificationSBT(
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
