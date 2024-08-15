// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./interfaces/IZkKYCVerifier.sol";

/**
 * @title Faucet: distributes Gala to users on testnet
 */
contract Faucet is AccessControl {

    uint256 public immutable epochDuration;
    uint256 public immutable epochStartTime;
    uint256 public immutable amountPerEpoch;

    mapping(bytes32 => uint256) public lastEpochClaimed;
    VerificationSBT public SBT;
    IZkKYCVerifier public verifierWrapper;

    constructor(address owner, uint256 _epochDuration, uint256 _epochStartTime, uint256 _amountPerEpoch) {
      _grantRole(DEFAULT_ADMIN_ROLE, owner);
      epochDuration = _epochDuration;
      epochStartTime = _epochStartTime;
      amountPerEpoch = _amountPerEpoch;
    }

    function getCurrentEpoch() view public returns (uint256) {
        return (block.timestamp - epochStartTime) / epochDuration;
    }

    function receiveWithoutSBT(uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[] memory input) public {
      return
    }

    function receiveWithSBT() {

    }


}
