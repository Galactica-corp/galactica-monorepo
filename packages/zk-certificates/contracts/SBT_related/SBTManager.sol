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

    //
    function mintSBT(
        uint index,
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[] memory input) {
          IVerifierWrapper verifierWrapper = IVerifierWrapper(SBTIndexToSBTVerifierWrapper[index]);
          /* In the first 3 cases we deal with TwitterFollowerCount circuit with
          - INDEX_VERIFICATION_EXPIRATION = 1
          - INDEX_FOLLOWERS_COUNT_THRESHOLD = 7
          In the other two cases we deal with TwitterCreationTime circuit with
          - INDEX_VERIFICATION_EXPIRATION = 1
          - INDEX_CREATION_TIME = 8
          */
          uint expirationTime = input[1]
          if (index == 0) {
            require(input[7] == 100, "Followers count threshold is not met");
          } else if (index == 1) {
            require(input[7] == 1000, "Followers count threshold is not met");
          } else if (index == 2) {
            require(input[7] == 10000, "Followers count threshold is not met");
          } else if (index == 3) {
            require(input[8] < 100, "Creation time is not valid");
          } else if (index == 4) {
            require(input[8] > 100, "Creation time is not valid");
          } else if (index == 5) {
            revert("Invalid index");
          }
          require(verifierWrapper.verifyProof(a, b, c, input), "Proof is not valid");
          // for twitterZkCertificate related SBTs we set the encryptedData, userPubKey, humanID, providerPubkey to be 0
          IERC721(SBTIndexToSBTAddress[index]).mint(
            msg.sender,
            verifierWrapper,
            expirationTime,
            bytes32(0),
            uint[2](0,0),
            bytes32(0),
            uint[2](0,0));
        }
}
