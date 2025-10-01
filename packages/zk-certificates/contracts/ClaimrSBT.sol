// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/** EIP-5192 Minimal Soulbound NFTs */
interface IERC5192 {
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);

    function locked(uint256 tokenId) external view returns (bool);
}

import {ECDSA} from '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import {MessageHashUtils} from '@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol';
import {ERC721} from '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';

contract claimrSMNFT is ERC721, Ownable, IERC5192 {
    using ECDSA for bytes32;

    // --------------------------- Versioning ------------------------------
    string public constant CONTRACT_TEMPLATE = 'claimrSM';
    uint64 public constant CONTRACT_TEMPLATE_VERSION = 2;

    function templateVersion()
        external
        pure
        returns (string memory name, uint64 version)
    {
        return (CONTRACT_TEMPLATE, CONTRACT_TEMPLATE_VERSION);
    }

    error NotSigned();
    error TicketUsed();
    error NonTransferable();
    error NonexistentToken();
    error NotOwningToken();

    uint256 private _nextTokenId;
    string private _baseTokenURI;
    address private _signee;
    mapping(bytes32 => bool) private _usedTicket;

    event SigneeSet(address indexed oldSignee, address indexed newSignee);
    event ContractURISet(string newURI);
    event TypeURISet(bytes32 indexed typeKey, string uri);

    constructor(
        string memory name,
        string memory symbol,
        address initialSignee
    ) ERC721(name, symbol) Ownable(msg.sender) {
        _signee = initialSignee;
    }

    // ---------------------------- Internal Mint --------------------------
    function _mintWithType(address to) internal returns (uint256 tokenId) {
        tokenId = _nextTokenId;
        unchecked {
            _nextTokenId = tokenId + 1;
        }

        _mint(to, tokenId);

        emit Locked(tokenId);
    }

    // ---------------------------- Mint / Burn ----------------------------
    function mint(string calldata token, bytes calldata signature) external {
        bytes32 ticketHash = keccak256(
            abi.encodePacked(address(this), msg.sender, token)
        );
        address recovered = ECDSA.recover(
            MessageHashUtils.toEthSignedMessageHash(ticketHash),
            signature
        );
        if (recovered != _signee) revert NotSigned();

        if (_usedTicket[ticketHash]) revert TicketUsed();
        _usedTicket[ticketHash] = true;

        _mintWithType(msg.sender);
    }

    function adminMint(address to) external onlyOwner {
        _mintWithType(to);
    }

    function adminMintBatch(address[] calldata to) external onlyOwner {
        for (uint256 i; i < to.length; ++i) {
            _mintWithType(to[i]);
        }
    }

    function burn(uint256 tokenId) external {
        _requireOwned(tokenId);
        if (_ownerOf(tokenId) != msg.sender) revert NotOwningToken();
        _burn(tokenId);
    }

    // --------------------------- Admin / Config --------------------------
    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        require(
            tokenId < _nextTokenId,
            'ERC721Metadata: URI query for nonexistent token'
        );

        return _baseTokenURI;
    }

    function setSignee(address newSignee) external onlyOwner {
        address old = _signee;
        _signee = newSignee;
        emit SigneeSet(old, newSignee);
    }

    function signee() external view returns (address) {
        return _signee;
    }

    // -------------------- SBT (non-transferable) rules -------------------
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721) returns (address from) {
        address current = _ownerOf(tokenId);
        if (current != address(0) && to != address(0)) revert NonTransferable();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override {
        revert NonTransferable();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert NonTransferable();
    }

    // ------------------------------ EIP-5192 -----------------------------
    function locked(uint256 tokenId) external view override returns (bool) {
        if (_ownerOf(tokenId) == address(0)) revert NonexistentToken();
        return true;
    }

    // ----------------------------- ERC165 --------------------------------
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721) returns (bool) {
        return
            interfaceId == type(IERC5192).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
