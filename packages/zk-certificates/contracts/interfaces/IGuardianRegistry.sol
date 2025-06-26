// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;

interface IGuardianRegistry {
    function isWhitelisted(address issuer) external view returns (bool);

    function pubKeyToAddress(
        uint256 pubKeyX,
        uint256 pubKeyY
    ) external view returns (address);
}
