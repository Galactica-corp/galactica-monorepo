// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./interfaces/IZkKYCVerifier.sol";

/**
 * @title AirdropGateway: manages airdrops for the Galactica
 */
contract SBTManager is AccessControl {

    mapping(uint => address) public SBTIndexToSBTAddress;
    mapping(uint => address) public SBTIndexToSBTVerifierWrapper;

    constructor(address owner) {
        // set admin, the role that can assign and revoke other roles
        _setupRole(DEFAULT_ADMIN_ROLE, owner);
    }

    function setSBT(uint index, address SBTAddress, address SBTAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        SBTIndexToSBTAddress[index] = SBTAddress;
    }

    function setSBTVerifierWrapper(uint index, address SBTVerifierWrapperAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        SBTIndexToSBTVerifierWrapper[index] = SBTVerifierWrapperAddress;
    }

    function mintSBT(uint index, uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[] memory input) {
          
        }



}
