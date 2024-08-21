// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./interfaces/IZkKYCVerifier.sol";
import "./interfaces/IVerificationSBT.sol";


/**
 * @title Faucet: distributes Gala to users on testnet
 */
contract Faucet is AccessControl {

    uint256 public immutable epochDuration;
    uint256 public immutable epochStartTime;
    uint256 public immutable amountPerEpoch;

    mapping(bytes32 => uint256) public lastEpochClaimed;
    mapping(bytes32 => address) public humanIdToAddress;
    IVerificationSBT public immutable SBT;
    IZkKYCVerifier public immutable verifierWrapper;

    constructor(address owner, uint256 _epochDuration, uint256 _epochStartTime, uint256 _amountPerEpoch, IVerificationSBT _SBT, IZkKYCVerifier _verifierWrapper) {
      _grantRole(DEFAULT_ADMIN_ROLE, owner);
      epochDuration = _epochDuration;
      epochStartTime = _epochStartTime;
      amountPerEpoch = _amountPerEpoch;
      SBT = _SBT;
      verifierWrapper = _verifierWrapper;
    }

    function getCurrentEpoch() view public returns (uint256) {
        return ((block.timestamp - epochStartTime) / epochDuration) + 1;
    }

    /* function to claim without SBT
    used when the user still doesn't have SBT or it expired
    can be called by anyone with the correct proof
    the fund will be sent to the user address specified in the proof
    */
    function claimWithoutSBT(uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[] memory input) public {
        bytes32 humanID = bytes32(input[verifierWrapper.INDEX_HUMAN_ID()]);

        uint dAppAddress = input[verifierWrapper.INDEX_DAPP_ID()];

        address userAddress = address(uint160(input[verifierWrapper.INDEX_USER_ADDRESS()]));

        // check that the public dAppAddress is correct
        require(
            dAppAddress == uint(uint160(address(this))),
            "incorrect dAppAddress"
        );
        // check if there is an SBT for that humanID then proceed accordingly
        if (SBT.isVerificationSBTValid(humanIdToAddress[humanID], address(this))) {
          // SBT still valid for a different address
          if (humanIdToAddress[humanID] != userAddress) {
            revert("SBT is still valid for different address.");
          // if there is an SBT for that address then we transfer fund without minting a new SBT
          // but we recommend the user to use claimWithSBT() to avoid any confusion
          } else {
            _transferForHumanId(humanID);
          }
        } else {

          // we check the validity of the proof
          // here we use the second variation because the user address is already checked earlier
          require(verifierWrapper.verifyProof2(a, b, c, input), "invalid proof");

          //afterwards we mint the verification SBT
          uint256[2] memory userPubKey = [
              input[verifierWrapper.INDEX_USER_PUBKEY_AX()],
              input[verifierWrapper.INDEX_USER_PUBKEY_AY()]
          ];
          uint amountInstitutions = verifierWrapper
              .getAmountFraudInvestigationInstitutions();
          bytes32[] memory encryptedData = new bytes32[](amountInstitutions * 2);
          for (uint i = 0; i < amountInstitutions; i++) {
              encryptedData[2 * i] = bytes32(
                  input[verifierWrapper.START_INDEX_ENCRYPTED_DATA() + 2 * i]
              );
              encryptedData[2 * i + 1] = bytes32(
                  input[verifierWrapper.START_INDEX_ENCRYPTED_DATA() + 2 * i + 1]
              );
          }
          uint expirationTime = input[
              verifierWrapper.INDEX_VERIFICATION_EXPIRATION()
          ];
          uint256[2] memory providerPubKey = [
              input[verifierWrapper.INDEX_PROVIDER_PUBKEY_AX()],
              input[verifierWrapper.INDEX_PROVIDER_PUBKEY_AY()]
          ];

          SBT.mintVerificationSBT(
              userAddress,
              verifierWrapper,
              expirationTime,
              encryptedData,
              userPubKey,
              humanID,
              providerPubKey
          );
          humanIdToAddress[humanID] = userAddress;
          // then we transfer the fund
          _transferForHumanId(humanID);
        }
    } 

    function claimWithSBT() public {
      require(
            SBT.isVerificationSBTValid(msg.sender, address(this)),
            "no SBT found."
        );
      
      bytes32 humanId = SBT.getHumanID(msg.sender, address(this));
      // in theory this check should be redundant, but I put it here to make sure
      require(humanIdToAddress[humanId] == msg.sender, "address not matched");
      _transferForHumanId(humanId);
    }

    // internal function to transfer and update state variables accordingly
    function _transferForHumanId(bytes32 humanId) internal {
      address userAddress = humanIdToAddress[humanId];
      uint256 currentEpoch = getCurrentEpoch();
      // check if the user has claimed in the current epoch
      if (currentEpoch == lastEpochClaimed[humanId]) {
        revert("User has already claimed in the current epoch.");
      }
      uint256 amount = amountPerEpoch;
      lastEpochClaimed[humanId] = currentEpoch;
      payable(userAddress).transfer(amount);
    }

    // view function to get the amount that the user can claim
    function getAmountClaimable(bytes32 humanId) public view returns (uint256) {
      uint256 currentEpoch = getCurrentEpoch();
      if (currentEpoch == lastEpochClaimed[humanId]) {
        return 0;
      } else {
        return amountPerEpoch;
      }
    }

    receive() external payable {}
}
