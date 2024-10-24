// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;
import '../SBT_related/VerificationSBT.sol';
import '../interfaces/IZkKYCVerifier.sol';
import {IVerificationSBT} from '../interfaces/IVerificationSBT.sol';
import {IVerificationSBTIssuer} from '../interfaces/IVerificationSBTIssuer.sol';

/**
 * @title RepeatableZKPTest is a simple smart contract that can be used to test ZKP submission to create a verification SBT
 * @author Galactica dev team
 */

contract RepeatableZKPTest is IVerificationSBTIssuer {
    IVerificationSBT public sbt;
    IZkKYCVerifier public verifierWrapper;

    constructor(
        IZkKYCVerifier _verifierWrapper,
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

    function submitZKP(
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

    /**
     * @notice isVerified checks if an address provided a valid ZKP and got a verification SBT
     * @param account the address to check
     */
    function isVerified(address account) public view returns (bool) {
        return sbt.isVerificationSBTValid(account);
    }
}
