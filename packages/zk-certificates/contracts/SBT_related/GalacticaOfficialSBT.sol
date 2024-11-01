// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import {Fallback} from '../helpers/Fallback.sol';

/**
 * @title GalacticaOfficialSBT: ERC721 NFT with URI storage for metadata used for governance in Discord
 * @dev ERC721 contains logic for NFT storage and metadata.
 */
contract GalacticaOfficialSBT is ERC721, AccessControl, Fallback {
    // roles for access control
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    // base URI for NFTs
    string private baseURI;

    constructor(
        address issuer,
        string memory uri,
        address owner,
        string memory nftName,
        string memory nftSymbol
    ) ERC721(nftName, nftSymbol) {
        // set admin, the role that can assign and revoke other roles
        _setupRole(DEFAULT_ADMIN_ROLE, owner);
        // only addresses assigned to this role will be able to mint and burn NFTs
        _setupRole(ISSUER_ROLE, issuer);

        baseURI = uri;
    }

    /**
     * @dev Mint a NFT for a user
     * @param user Address that should receive the NFT
     */
    function mint(address user) public onlyRole(ISSUER_ROLE) {
        // the id of each NFT will be uniquely defined by the user holding it
        // 1 to 1 relation
        uint256 newNFTId = getIDForAddress(user);
        // using _mint instead of _safeMint to prevent the contract from reverting
        //  if a smart contract is staking and has not implemented the onERC721Received function
        _mint(user, newNFTId);
    }

    /**
     * @dev Mint a NFT for a batch of user
     * @param users Array of address that should receive the NFT
     */
    function batchMint(address[] calldata users) public onlyRole(ISSUER_ROLE) {
        for (uint i = 0; i < users.length; i++) {
            uint256 newNFTId = getIDForAddress(users[i]);
            _mint(users[i], newNFTId);
        }
    }

    /**
     * @dev Burn a NFT of a user
     * @param user Address that should have the NFT burned. Information about the holder is enough because there is as most one NFT per user.
     */
    function burn(address user) public onlyRole(ISSUER_ROLE) {
        // the id of each NFT will be uniquely defined by the user holding it
        // 1 to 1 relation
        uint256 id = getIDForAddress(user);
        _burn(id);
    }

    /**
     * @dev Get NFT id of user or 0 for none.
     *
     * @param user The address of the NFT owner.
     * @return Returns the id of the NFT for the given address and 0 if the address has no NFTs.
     */
    function getNFTHoldBy(address user) public view returns (uint256) {
        uint256 id = getIDForAddress(user);
        if (balanceOf(user) == 1) {
            assert(ownerOf(id) == user);
            return id;
        }
        return 0;
    }

    /**
     * Implementing ERC165 as needed by AccessControl and ERC721
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, AccessControl) returns (bool) {
        return
            ERC721.supportsInterface(interfaceId) ||
            AccessControl.supportsInterface(interfaceId);
    }

    /**
     * @dev Each address can at most have one NFT. This function assigns as id to a user by convertng the address to uint256
     * @param user address of the user
     */
    function getIDForAddress(address user) public pure returns (uint256) {
        return uint256(uint160(user));
    }

    /**
     * @dev Each address can at most have one NFT. This function get the address belonging to an id
     * @param id NFT id
     */
    function getAddressForID(uint256 id) public pure returns (address) {
        return address(uint160(id));
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        _requireMinted(tokenId);
        // concatinate base URI with holder address
        // address will be lower case and not have checksum encoding
        return baseURI;
    }

    /**
     * @dev Base URI for computing {tokenURI}. If set, the resulting URI for each
     * token will be the concatenation of the `baseURI` and the `tokenId`.
     */
    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    /**
     * @dev Transfers are rejected because the GalacticaTwitterSBT is soulbound.
     */
    function _transfer(address, address, uint256) internal pure override {
        revert("GalacticaTwitterSBT: transfer is not allowed");
    }

    /**
     * @dev Approve are rejected because the GalacticaTwitterSBT is soulbound.
     */
    function _approve(address to, uint256 id) internal override {
        if (to == address(0)) {
            // ok to approve zero address as done by the ERC721 implementation on burning
            super._approve(to, id);
        } else {
            revert("GalacticaTwitterSBT: transfer approval is not allowed");
        }
    }
}