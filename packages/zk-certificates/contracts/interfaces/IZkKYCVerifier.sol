// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "./IVerifierWrapper.sol";

/// @author Galactica dev team
interface IZkKYCVerifier is IVerifierWrapper {
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[] memory input
    ) external view returns (bool);

    function fraudInvestigationInstitutions()
        external
        view
        returns (address[] memory);

    function getAmountFraudInvestigationInstitutions()
        external
        view
        returns (uint);

    function INDEX_USER_PUBKEY_AX() external view returns (uint8);

    function INDEX_USER_PUBKEY_AY() external view returns (uint8);

    function INDEX_IS_VALID() external view returns (uint8);

    function INDEX_VERIFICATION_EXPIRATION() external view returns (uint8);

    function START_INDEX_ENCRYPTED_DATA() external view returns (uint8);

    function INDEX_ROOT() external view returns (uint8);

    function INDEX_CURRENT_TIME() external view returns (uint8);

    function INDEX_USER_ADDRESS() external view returns (uint8);

    function INDEX_HUMAN_ID() external view returns (uint8);

    function INDEX_DAPP_ID() external view returns (uint8);

    function INDEX_PROVIDER_PUBKEY_AX() external view returns (uint8);

    function INDEX_PROVIDER_PUBKEY_AY() external view returns (uint8);

    function START_INDEX_INVESTIGATION_INSTITUTIONS()
        external
        view
        returns (uint8);
}
