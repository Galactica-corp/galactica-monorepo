// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./interfaces/IZkKYCVerifier.sol";

/**
 * @title AirdropGateway: manages airdrops for the Galactica
 */
contract AirdropGateway is AccessControl {
    // roles for access control
    bytes32 public constant CLIENT_ROLE = keccak256("CLIENT_ROLE");

    AirdropDistribution public currentDistribution;
    // userAddress -> registration status
    mapping(address => bool) public registeredUsers;
    // humanId => registration status
    mapping(bytes32 => bool) public registeredHumanID;
    // userAddress -> claimed status
    mapping(address => bool) public claimedUsers;
    IZkKYCVerifier public verifierWrapper;

    event DistributionCreated(address client);
    event UserRegistered(address user);
    event UserClaimed(address user, uint amount);

    // struct to store airdrop distribution information
    struct AirdropDistribution {
        address[] requiredSBTs;
        uint registrationStartTime;
        uint registrationEndTime;
        uint claimStartTime;
        uint claimEndTime;
        address clientAddress;
        address tokenAddress;
        uint256 distributionAmount;
        uint256 registeredUserCount;
        uint256 tokenAmountPerUser;
        uint256 amountClaimed;
    }

    constructor(address owner, address verifierWrapperAddress) {
        verifierWrapper = IZkKYCVerifier(verifierWrapperAddress);
        // set admin, the role that can assign and revoke other roles
        _setupRole(DEFAULT_ADMIN_ROLE, owner);
    }

    function whitelistClient(address newClient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(CLIENT_ROLE, newClient);
    }

    function dewhitelistClient(address client) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(CLIENT_ROLE, client);
    }

    function setDistribution(address[] memory requiredSBTs, address tokenAddress, uint registrationStartTime, uint registrationEndTime, uint claimStartTime, uint claimEndTime) external onlyRole(CLIENT_ROLE) {
        require(currentDistribution.clientAddress == address(0), "distribution has already been set");
        require(registrationStartTime < registrationEndTime, "invalid registration time");
        require(registrationEndTime < claimStartTime, "claim can only start after registration ends");
        require(claimStartTime < claimEndTime, "invalid claim time");
        currentDistribution = AirdropDistribution(requiredSBTs, registrationStartTime, registrationEndTime, claimStartTime, claimEndTime, msg.sender, tokenAddress, 0, 0, 0, 0);
        emit DistributionCreated(msg.sender);
    }

    function getRequiredSBTs() external view returns (address[] memory) {
        return currentDistribution.requiredSBTs;
    }

    /* deposit tokens to the distribution
     we choose to not sending the tokens to distribution contract address directly
     to just in case distinguish between two distributions with the same token address
    */
    function deposit(uint amount) external onlyRole(CLIENT_ROLE) {
        require(currentDistribution.claimStartTime > block.timestamp, "claim has already started");
        require(currentDistribution.clientAddress == msg.sender, "only client can deposit");
        IERC20(currentDistribution.tokenAddress).transferFrom(msg.sender, address(this), amount);
        currentDistribution.distributionAmount += amount;
    }

    function withdrawRemainingToken() external onlyRole(CLIENT_ROLE) {
        require(currentDistribution.clientAddress == msg.sender, "only client can withdraw");
        require(currentDistribution.claimEndTime < block.timestamp, "claim has not ended yet");
        uint256 amountLeft = currentDistribution.distributionAmount - currentDistribution.amountClaimed;
        IERC20(currentDistribution.tokenAddress).transfer(msg.sender, amountLeft);
    }
    //
    function register(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[] memory input) external {

        bytes32 humanID = bytes32(input[verifierWrapper.INDEX_HUMAN_ID()]);
        uint dAppAddress = input[verifierWrapper.INDEX_DAPP_ID()];

        // check that the public dAppAddress is correct
        require(
            dAppAddress == uint(uint160(address(this))),
            "incorrect dAppAddress"
        );

        // check the zk proof
        require(currentDistribution.tokenAddress != address(0), "distribution is not set");
        require(verifierWrapper.verifyProof(a, b, c, input), "invalid proof");
        require(registeredHumanID[humanID] == false, "user has already registered");
        require(currentDistribution.registrationStartTime < block.timestamp, "registration has not started yet");
        require(currentDistribution.registrationEndTime > block.timestamp, "registration has ended");
        address[] memory requiredSBTs = currentDistribution.requiredSBTs;
        for (uint i = 0; i < requiredSBTs.length; i++) {
            require(IERC721(requiredSBTs[i]).balanceOf(msg.sender) > 0, "user does not have required SBT");
        }
        registeredUsers[msg.sender] = true;
        registeredHumanID[humanID] = true;
        currentDistribution.registeredUserCount++;
        emit UserRegistered(msg.sender);
    }

    function claim() external {
        require(currentDistribution.claimStartTime < block.timestamp, "claim has not started yet");
        require(currentDistribution.claimEndTime > block.timestamp, "claim has ended");
        require(registeredUsers[msg.sender], "user has not registered");
        require(claimedUsers[msg.sender] == false, "user has already claimed");
        // calculate token amount per user if it hasn't been done yet
        if (currentDistribution.tokenAmountPerUser == 0) {
            currentDistribution.tokenAmountPerUser = currentDistribution.distributionAmount / currentDistribution.registeredUserCount;
        }
        IERC20(currentDistribution.tokenAddress).transfer(msg.sender, currentDistribution.tokenAmountPerUser);
        currentDistribution.amountClaimed += currentDistribution.tokenAmountPerUser;
        claimedUsers[msg.sender] = true;
        emit UserClaimed(msg.sender, currentDistribution.tokenAmountPerUser);
    }


}
