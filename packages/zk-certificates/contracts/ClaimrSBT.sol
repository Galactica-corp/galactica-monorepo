// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract claimrSignedSBT is Ownable, ERC721 {
    uint256 private _nextTokenId;
    string private _baseTokenURI;
    mapping(string => bool) private _usedTokens;
    address private _signee;

    constructor(
        string memory name,
        string memory symbol,
        string memory baseTokenURI_,
        address signee_
    ) ERC721(name, symbol) Ownable() {
        _baseTokenURI = baseTokenURI_;
        _signee = signee_;
    }

    function mint(string memory token, bytes memory signature) public {
        require(verify(token, signature, _signee), 'NOT_SIGNED_BY_SIGNEE');
        require(!_usedTokens[token], 'TOKEN_USED');
        _usedTokens[token] = true;
        uint256 tokenId = _nextTokenId++;
        _mint(msg.sender, tokenId);
    }

    function setSignee(address newSignee) public onlyOwner {
        _signee = newSignee;
    }

    function signee() public view virtual returns (address) {
        return _signee;
    }

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

    function verify(
        string memory message,
        bytes memory signature,
        address signer
    ) public pure returns (bool) {
        // Recreate the message that was originally signed, based on tokenId
        bytes32 messageHash = keccak256(abi.encodePacked(message));
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked('\x19Ethereum Signed Message:\n32', messageHash)
        );
        // Recover the signer from the signature
        return recoverSigner(ethSignedMessageHash, signature) == signer;
    }

    // Function to recover the signer from a signature
    function recoverSigner(
        bytes32 ethSignedMessageHash,
        bytes memory signature
    ) internal pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(signature);
        return ecrecover(ethSignedMessageHash, v, r, s);
    }

    // Helper function to split the signature into r, s and v
    function splitSignature(
        bytes memory sig
    ) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, 'Invalid signature length');
        assembly {
            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }
    }

    function burn(uint256 tokenId) external onlyOwner {
        _requireMinted(tokenId);
        _burn(tokenId);
    }

    /**
     * @dev Transfers are rejected because the ClaimrSBT is soulbound.
     */
    function transfer(address, uint256) public pure {
        revert('ClaimrSBT: transfer is not allowed');
    }

    /**
     * @dev Transfers are rejected because the ClaimrSBT is soulbound.
     */
    function transferFrom(address, address, uint256) public pure override {
        revert('ClaimrSBT: transfer is not allowed');
    }

    function safeTransferFrom(address, address, uint256) public pure override {
        revert('ClaimrSBT: transfer is not allowed');
    }

    function safeTransferFrom(
        address,
        address,
        uint256,
        bytes memory
    ) public pure override {
        revert('ClaimrSBT: transfer is not allowed');
    }

    /**
     * @dev Approve are rejected because the ClaimrSBT is soulbound.
     */
    function approve(address to, uint256 id) public pure override {
        revert('ClaimrSBT: transfer approval is not allowed');
    }
}
