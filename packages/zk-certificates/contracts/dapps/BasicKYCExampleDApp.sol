// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;
import {VerificationSBT} from '../SBT_related/VerificationSBT.sol';
import {IZkKYCVerifier} from '../interfaces/IZkKYCVerifier.sol';
import {IVerificationSBT} from '../interfaces/IVerificationSBT.sol';
import {IVerificationSBTIssuer} from '../interfaces/IVerificationSBTIssuer.sol';
import {Fallback} from '../helpers/Fallback.sol';

/**
 * @title BasicKYCExampleDApp
 * @author Galactica dev team
 * @notice A simple DApp that requires a zkKYC proof to issue a Verification SBT.
 *  Registration can be repeated when the previous Verification SBT expired.
 *  The requirements of the ZKP (i.e. age, citizenship, etc.) are defined in the verifierWrapper.
 */
contract BasicKYCExampleDApp is IVerificationSBTIssuer, Fallback {
    IVerificationSBT public sbt;
    IZkKYCVerifier public verifierWrapper;

    /**
     * Constructor for the BasicKYCExampleDApp contract.
     * @param _verifierWrapper - IZkKYCVerifier that verifies the ZK proof integrety.
     * @param _uri - URI to SBT metadata (description, image, etc.).
     * @param _name - Name of the SBT token.
     * @param _symbol - Symbol of the SBT token.
     */
    constructor(
        IZkKYCVerifier _verifierWrapper,
        string memory _uri,
        string memory _name,
        string memory _symbol
    ) {
        verifierWrapper = _verifierWrapper;
        sbt = new VerificationSBT(_uri, _name, _symbol, address(this));
    }

    /**
     * @notice isVerified checks if an address provided a valid ZKP and got a verification SBT
     * @param account the address to check
     */
    function isVerified(address account) public view returns (bool) {
        return sbt.isVerificationSBTValid(account);
    }

    function registerKYC(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[] memory input
    ) public {
        require(
            !sbt.isVerificationSBTValid(msg.sender),
            'The user already has a verification SBT. Please wait until it expires.'
        );

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
        uint256[2] memory userPubKey = [
            input[verifierWrapper.INDEX_USER_PUBKEY_AX()],
            input[verifierWrapper.INDEX_USER_PUBKEY_AY()]
        ];
        uint amountInstitutions = verifierWrapper
            .getAmountFraudInvestigationInstitutions();
        bytes32[] memory encryptedData = new bytes32[](amountInstitutions * 2);
        for (uint i = 0; i < amountInstitutions; i++) {
            encryptedData[2 * i] = bytes32(
                input[verifierWrapper.START_INDEX_ENCRYPTED_DATA() + 2 * i]
            );
            encryptedData[2 * i + 1] = bytes32(
                input[verifierWrapper.START_INDEX_ENCRYPTED_DATA() + 2 * i + 1]
            );
        }
        uint expirationTime = input[
            verifierWrapper.INDEX_VERIFICATION_EXPIRATION()
        ];
        uint256[2] memory providerPubKey = [
            input[verifierWrapper.INDEX_PROVIDER_PUBKEY_AX()],
            input[verifierWrapper.INDEX_PROVIDER_PUBKEY_AY()]
        ];
        sbt.mintVerificationSBT(
            msg.sender,
            verifierWrapper,
            expirationTime,
            encryptedData,
            userPubKey,
            humanID,
            providerPubKey
        );
    }
}
