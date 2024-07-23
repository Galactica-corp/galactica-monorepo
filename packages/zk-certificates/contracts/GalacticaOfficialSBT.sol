// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title GalacticaTwitterSBT: ERC721 NFT with URI storage for metadata used for governance in Discord
 * @dev ERC721 contains logic for NFT storage and metadata.
 */
contract GalacticaOfficialSBT is ERC721, AccessControl {
    // Roles for access control
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    string public baseURI;
    // user next index to mint
    uint256 public tokenNextIndex;

    //mapping from token id to token customized metadata
    mapping(uint256 => string) public tokenURIs;
    mapping(uint256 => string) public tokenNames;
    mapping(uint256 => string) public tokenSymbol;

    //user to tokenids
    mapping(address => uint256[]) public userTokenIds;
    //token index in user's tokenIds array
    mapping(uint256 => uint256) public indexOfTokenId;

    event Minted(address indexed user, uint256 tokenId);
    event Burned(address indexed user, uint256 tokenId);

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

    // override the _mint function to allow for customized metadata
    function _mint(address user, string memory uri, string memory name, string memory symbol) internal {
        uint256 newNFTId = tokenNextIndex;
        tokenNextIndex++;
        ERC721._mint(user, newNFTId);
        tokenURIs[newNFTId] = uri;
        tokenNames[newNFTId] = name;
        tokenSymbol[newNFTId] = symbol;
        userTokenIds[user].push(newNFTId);
        indexOfTokenId[newNFTId] = userTokenIds[user].length - 1;
        emit Minted(user, newNFTId);
    }

    /**
     * @dev Mint a NFT for a user
     * @param user Address that should receive the NFT
     * customized metadata is not provided, thus we will use the default contract one
     */
    function mint(address user) public onlyRole(ISSUER_ROLE) {
        _mint(user, baseURI, name(), symbol());
    }

    /**
     * @dev Mint a NFT for a user with customized metadata
     * @param user Address that should receive the NFT
     * @param uri URI for the NFT
     * @param name Name for the NFT
     * @param symbol Symbol for the NFT
     */
    function mint(address user, string memory uri, string memory name, string memory symbol) public onlyRole(ISSUER_ROLE) {
        _mint(user, uri, name, symbol);
    }


    /**
     * @dev Mint a NFT for a batch of user
     * @param users Array of address that should receive the NFT
     */
    function batchMint(address[] calldata users) public onlyRole(ISSUER_ROLE) {
        for (uint i = 0; i < users.length; i++) {
            mint(users[i]);
        }
    }

    /**
     * @dev Burn a NFT of a certain index
     * @param id NFT id
     */
    function burn(uint id) public onlyRole(ISSUER_ROLE) {
        _burn(id);
        // remove the token id from the user tokenIds array
        uint256 index = indexOfTokenId[id];
        uint256 lastTokenId = userTokenIds[msg.sender][userTokenIds[msg.sender].length - 1];
        userTokenIds[msg.sender][index] = lastTokenId;
        indexOfTokenId[lastTokenId] = index;
        userTokenIds[msg.sender].pop();
        emit Burned(msg.sender, id);
    }

    /**
     * @dev Get NFT list of user or 0 for none.
     *
     * @param user The address of the NFT owner.
     * @return Returns the id array of the NFT for the given address and 0 if the address has no NFTs.
     */
    function getNFTHoldBy(address user) public view returns (uint256[] memory) {
        return userTokenIds[user];
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
     * @dev See {IERC721Metadata-tokenURI}.
     * if the token uri is not set, return the base uri
     */
    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        _requireMinted(tokenId);
        if (bytes(tokenURIs[tokenId]).length > 0) {
            return tokenURIs[tokenId];
        } else {
            return baseURI;
        }
    }

    /**
     * @dev Base URI for computing {tokenURI}. If set, the resulting URI for each
     * token will be the concatenation of the `baseURI` and the `tokenId`.
     */
    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    /**
     * @dev Change the base URI.
     * @param newBaseURI The new base URI.
     */
    function changeBaseURI(string memory newBaseURI) public onlyRole(DEFAULT_ADMIN_ROLE) {
      baseURI = newBaseURI;
    }

    // if custom name is not set, return the base one
    function name(uint256 tokenId) public view returns(string memory) {
      _requireMinted(tokenId);
      if (bytes(tokenNames[tokenId]).length > 0) {
        return tokenNames[tokenId];
      } else {
        return name();
      }
    }

    // if custom symbol is not set, return the base one
    function symbol(uint256 tokenId) public view returns(string memory) {
      _requireMinted(tokenId);
      if (bytes(tokenSymbol[tokenId]).length > 0) {
        return tokenSymbol[tokenId];
      } else {
        return symbol();
      }
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

