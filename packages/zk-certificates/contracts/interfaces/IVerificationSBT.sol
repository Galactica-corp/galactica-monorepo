// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;

/// @author Galactica dev team
import './IVerifierWrapper.sol';
import {IERC721Metadata} from '@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol';

interface IVerificationSBT is IERC721Metadata {
    struct VerificationSBTInfo {
        IVerifierWrapper verifierWrapper;
        uint256 expirationTime;
        bytes32 verifierCodehash;
        bytes32[] encryptedData; // containing two fields for each institutions
        uint256[2] userPubKey;
        bytes32 humanID;
        uint256[2] providerPubKey;
        uint256 tokenId;
    }

    function mintVerificationSBT(
        address user,
        IVerifierWrapper _verifierWrapper,
        uint _expirationTime,
        bytes32[] calldata _encryptedData,
        uint256[2] calldata _userPubKey,
        bytes32 _humanID,
        uint256[2] calldata _providerPubKey
    ) external;

    function mintVerificationSBT(
        address user,
        IVerifierWrapper _verifierWrapper,
        uint _expirationTime
    ) external;

    function isVerificationSBTValid(address user) external view returns (bool);

    function getVerificationSBTInfo(
        address user
    ) external view returns (VerificationSBTInfo memory);

    function getHumanID(address user) external view returns (bytes32);

    /// @dev returns the block number at which the contract was created, so that the frontend can search for logs from here instead of searching from genesis.
    function deploymentBlock() external view returns (uint64);
}
