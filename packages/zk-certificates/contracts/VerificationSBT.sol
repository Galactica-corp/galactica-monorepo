// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.9;

import "./interfaces/IVerificationSBT.sol";
import "./interfaces/IVerifierWrapper.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @author Galactica dev team
/// @title A global smart contract that store verification SBTs, minted by dApp for users submitting zk proofs
contract VerificationSBT is IVerificationSBT{
    // mapping to store verification SBT
    mapping(bytes32 => VerificationSBTInfo) public VerificationSBTMapping;
    // number of SBTs minted for each user address
    mapping(address => uint256) public balances;
    // token id counter
    uint256 public tokenCounter;
    // token id to owner
    mapping(uint256 => address) public tokenIdToOwner;
    // token id to dApp
    mapping(uint256 => address) public tokenIdToDApp;

    // base URI for NFTs
    string public baseURI;

    /// Block number at which the contract was created, so that the frontend can search for logs from here instead of searching from genesis.
    uint64 public deploymentBlock;

    // event emitted when a verification SBT is minted
    event VerificationSBTMinted(
        address indexed dApp,
        address indexed user,
        bytes32 indexed humanID
    );

    event Transfer(
        address indexed from,
        address indexed to,
        uint256 indexed tokenId
    );

    constructor(string memory uri) {
        deploymentBlock = uint64(block.number);
        baseURI = uri;
    }

    function mintVerificationSBT(
        address user,
        IVerifierWrapper _verifierWrapper,
        uint _expirationTime,
        bytes32[] calldata _encryptedData,
        uint256[2] calldata _userPubKey,
        bytes32 _humanID,
        uint256[2] calldata _providerPubKey
    ) external {
        uint tokenId = tokenCounter;
        // The function is public so anyone can call it, but the msg.sender is included in the key, so that each dApp can only mint SBTs corresponding to it. When we search for relevant SBTs we only care about the corresponding mapping keys.
        VerificationSBTMapping[
            keccak256(abi.encode(user, msg.sender))
        ] = VerificationSBTInfo({
            dApp: msg.sender,
            verifierWrapper: _verifierWrapper,
            expirationTime: _expirationTime,
            verifierCodehash: _verifierWrapper.verifier().codehash,
            encryptedData: _encryptedData,
            userPubKey: _userPubKey,
            humanID: _humanID,
            providerPubKey: _providerPubKey,
            tokenId: tokenId
        });

        tokenIdToOwner[tokenId] = user;
        tokenIdToDApp[tokenId] = msg.sender;
        tokenCounter += 1;
        balances[user] += 1;
        emit VerificationSBTMinted(msg.sender, user, _humanID);
        emit Transfer(address(0), user, tokenId);
    }

    function isVerificationSBTValid(
        address user,
        address dApp
    ) public view returns (bool) {
        VerificationSBTInfo
            storage verificationSBTInfo = VerificationSBTMapping[
                keccak256(abi.encode(user, dApp))
            ];
        // we check 2 conditions
        // 1. the verifier wrapper address is set and the codehash of the verifier is still the same as the one referred to in the verification wrapper
        // 2. the expiration time hasn't happened yet
        return
            (address(verificationSBTInfo.verifierWrapper) != address(0)) &&
            (verificationSBTInfo.verifierWrapper.verifier().codehash ==
                verificationSBTInfo.verifierCodehash) &&
            (verificationSBTInfo.expirationTime > block.timestamp);
    }

    function getVerificationSBTInfo(
        address user,
        address dApp
    ) public view returns (VerificationSBTInfo memory) {
        return VerificationSBTMapping[keccak256(abi.encode(user, dApp))];
    }

    function getVerificationSBTInfoById(uint256 tokenId) public view returns (VerificationSBTInfo memory) {
        return getVerificationSBTInfo(tokenIdToOwner[tokenId], tokenIdToDApp[tokenId]);
    }

    function getHumanID(
        address user,
        address dApp
    ) public view returns (bytes32) {
        return
            VerificationSBTMapping[keccak256(abi.encode(user, dApp))].humanID;
    }

    function balanceOf(address user) external view returns (uint256 balance) {
      balance = balances[user];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        return tokenIdToOwner[tokenId];
    }

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return
            interfaceId == type(IERC721).interfaceId;
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        return ownerOf(tokenId) != address(0);
    }

    function _requireMinted(uint256 tokenId) internal view {
        require(_exists(tokenId), "ERC721: invalid token ID");
    }

    function tokenURI(
        uint256 tokenId
    ) public view returns (string memory) {
        _requireMinted(tokenId);
        return baseURI;
    }
}
