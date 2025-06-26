// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;

import '../interfaces/IZkKYCVerifier.sol';
import '../interfaces/IZkCertificateRegistry.sol';
import '../interfaces/IGalacticaInstitution.sol';
import '../interfaces/IVerificationSBT.sol';
import '../interfaces/IVerifierWrapper.sol';
import '../interfaces/ICircomVerifier.sol';

/// @author Galactica dev team
/// @title a mock ZkKYC which always returns true
contract MockZkKYC is IVerifierWrapper {
    uint public constant INDEX_HUMAN_ID = 0;
    uint public constant INDEX_USER_PUBKEY_AX = 1;
    uint public constant INDEX_USER_PUBKEY_AY = 2;
    uint public constant INDEX_VERIFICATION_EXPIRATION = 4;
    uint public constant INDEX_USER_ADDRESS = 7; // we mostly have 0 institutions in the mockZkKYC
    uint public constant INDEX_DAPP_ID = 8;
    uint public constant INDEX_PROVIDER_PUBKEY_AX = 9;
    uint public constant INDEX_PROVIDER_PUBKEY_AY = 10;

    //a, b, c are the proof
    // input array contains the public parameters: isValid, root, currentTime
    function verifyProof(
        uint[2] memory,
        uint[2][2] memory,
        uint[2] memory,
        uint[] memory
    ) public pure returns (bool) {
        return true;
    }

    function verifyProof2(
        uint[2] memory,
        uint[2][2] memory,
        uint[2] memory,
        uint[] memory
    ) public pure returns (bool) {
        return true;
    }

    function earnVerificationSBT(
        IVerificationSBT verificationSBT,
        uint expirationTime,
        bytes32[] calldata _encryptedData,
        uint[2] calldata _userPubKey,
        bytes32 _humanID,
        uint[2] calldata _providerPubKey
    ) external {
        verificationSBT.mintVerificationSBT(
            msg.sender,
            this,
            expirationTime,
            _encryptedData,
            _userPubKey,
            _humanID,
            _providerPubKey
        );
    }

    function verifier() public pure returns (ICircomVerifier) {
        return ICircomVerifier(address(0));
    }

    function getAmountFraudInvestigationInstitutions()
        public
        pure
        returns (uint)
    {
        return 0;
    }
}
