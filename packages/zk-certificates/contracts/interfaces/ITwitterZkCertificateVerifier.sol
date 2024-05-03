// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "./IVerifierWrapper.sol";

/// @author Galactica dev team
interface ITwitterZkCertificateVerifier is IVerifierWrapper {
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[] memory input
    ) external view returns (bool);

    function INDEX_IS_VALID() external view returns (uint8);

    function INDEX_VERIFICATION_EXPIRATION() external view returns (uint8);

    function INDEX_ROOT() external view returns (uint8);

    function INDEX_CURRENT_TIME() external view returns (uint8);

    function INDEX_USER_ADDRESS() external view returns (uint8);

    function INDEX_PROVIDER_PUBKEY_AX() external view returns (uint8);

    function INDEX_PROVIDER_PUBKEY_AY() external view returns (uint8);
}
