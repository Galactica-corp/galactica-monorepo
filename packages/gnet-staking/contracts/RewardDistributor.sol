// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.28;
pragma experimental ABIEncoderV2;

import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import {Ownable2StepUpgradeable} from '@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol';
import {Fallback} from '@galactica-net/zk-certificates/contracts/helpers/Fallback.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {MerkleProof} from '@openzeppelin/contracts/utils/cryptography/MerkleProof.sol';

/**
 * @title RewardDistributor
 * @notice Contract for claiming rewards on-chain based on a merkle tree holding reward data
 * @dev The reward data is calculated offchain and stored in a merkle tree. The merkle proof about rewards needs to be provided off-chain and is only verified on-chain.
 *      Supports both ERC20 tokens and native tokens (ETH). When rewardToken is set to address(0), native tokens are distributed.
 */
contract RewardDistributor is Ownable2StepUpgradeable, Fallback {
    using SafeERC20 for IERC20;

    event AddEpoch(
        uint256 indexed epochIndex,
        bytes32 merkleRoot,
        uint256 additionTime
    );
    event ClaimReward(
        bytes32 indexed merkleRoot,
        address indexed sendToAddress,
        address indexed account,
        uint256 leafIndex,
        uint256 amount
    );
    address public assetManager;
    address public rewardToken;
    bytes32 public rewardMerkleRoot;
    uint256 public totalRewardClaimed;
    uint256 public currentEpoch;
    mapping(address => uint256) public userTotalRewardClaimed;
    mapping(address => uint256) public userLastClaimedEpoch;

    /**
     * @dev Disable the constructor for the deployment as recommended by OpenZeppelin. Instead the upgradeable proxy will use the initialize function.
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Receive ETH from the caller.
     */
    receive() external payable {}

    /**
     * @notice Initialize the contract with this function because a smart contract behind a proxy can't have a constructor.
     * @param _owner The owner of the contract.
     * @param _assetManager The asset manager of the contract.
     * @param _rewardToken The reward token of the contract. Set to address(0) to use native tokens (ETH).
     */
    function initialize(
        address _owner,
        address _assetManager,
        address _rewardToken
    ) public initializer {
        assetManager = _assetManager;
        rewardToken = _rewardToken;

        __Ownable_init(_owner);
    }

    modifier onlyAssetManager() {
        require(
            msg.sender == assetManager,
            'RewardDistributor: Only asset manager can call this function.'
        );
        _;
    }

    /**
     * @notice Change the asset manager of the contract.
     * @param newAssetManager The new asset manager of the contract.
     */
    function changeAssetManager(
        address newAssetManager
    ) public onlyAssetManager {
        assetManager = newAssetManager;
    }

    /**
     * @notice Withdraw ETH from the contract to the asset manager.
     */
    function withdrawETH() public onlyAssetManager {
        payable(assetManager).transfer(address(this).balance);
    }

    /**
     * @notice Withdraw ERC20 tokens from the contract to the asset manager.
     * @param token The token to withdraw.
     */
    function withdrawERC20(IERC20 token) public onlyAssetManager {
        token.transfer(assetManager, token.balanceOf(address(this)));
    }

    /**
     * @notice Update the reward merkle root and update the epoch index.
     * @param newRewardMerkleRoot The new reward merkle root.
     */
    function updateRewardMerkleRoot(
        bytes32 newRewardMerkleRoot
    ) public onlyOwner {
        rewardMerkleRoot = newRewardMerkleRoot;
        currentEpoch = currentEpoch + 1;
        emit AddEpoch(currentEpoch, newRewardMerkleRoot, block.timestamp);
    }

    /**
     * @notice Change the reward merkle root in case there is some mistake, i.e. we keep the current epoch index.
     * @param newRewardMerkleRoot The new reward merkle root.
     */
    function changeFalseRewardMerkleRoot(
        bytes32 newRewardMerkleRoot
    ) public onlyOwner {
        rewardMerkleRoot = newRewardMerkleRoot;
        emit AddEpoch(currentEpoch, newRewardMerkleRoot, block.timestamp);
    }

    /**
     * @notice Change the reward token.
     * @param newRewardToken The new reward token. Set to address(0) to use native tokens (ETH).
     */
    function changeRewardToken(address newRewardToken) public onlyOwner {
        rewardToken = newRewardToken;
    }

    struct ClaimInput {
        uint256 leafIndex;
        address account;
        uint256 amount;
        bytes32[] merkleProof;
    }

    /**
     * @dev internal function to verify merkle proof
     * @param claimInput The claim input.
     * @param merkleRoot The merkle root we check the claimInput against.
     */
    function _verify(
        ClaimInput memory claimInput,
        bytes32 merkleRoot
    ) internal pure {
        bytes32 node = keccak256(
            abi.encode(
                claimInput.leafIndex,
                claimInput.account,
                claimInput.amount
            )
        );
        require(
            MerkleProof.verify(claimInput.merkleProof, merkleRoot, node),
            'RewardDistributor: Invalid merkle proof.'
        );
    }

    /**
     * @dev function to verify user's outstanding reward amount
     * @param claimInput The claim input.
     */
    function userUnclaimedReward(
        ClaimInput memory claimInput
    ) public view returns (uint256) {
        // we check the merkle proof
        _verify(claimInput, rewardMerkleRoot);

        return claimInput.amount - userTotalRewardClaimed[claimInput.account];
    }

    /**
     * @dev internal function to check merkle proof and internal claimed reward states
     * @param claimInput The amount inside this struct is the accumulated reward from the beginning of reward distribution
     * @param sendToAddress The address to send the reward to.
     */
    function _claim(
        ClaimInput memory claimInput,
        address sendToAddress
    ) internal {
        // we check the merkle proof
        _verify(claimInput, rewardMerkleRoot);

        uint256 amountToClaim = claimInput.amount -
            userTotalRewardClaimed[claimInput.account];
        userTotalRewardClaimed[claimInput.account] = claimInput.amount;
        userLastClaimedEpoch[claimInput.account] = currentEpoch;
        totalRewardClaimed += amountToClaim;

        if (rewardToken == address(0)) {
            // Native token transfer
            (bool success, ) = payable(sendToAddress).call{
                value: amountToClaim
            }('');
            require(success, 'RewardDistributor: ETH transfer failed');
        } else {
            // ERC20 token transfer
            IERC20(rewardToken).safeTransfer(sendToAddress, amountToClaim);
        }

        emit ClaimReward(
            rewardMerkleRoot,
            sendToAddress,
            claimInput.account,
            claimInput.leafIndex,
            amountToClaim
        );
    }

    /**
     * @notice Claim the reward to the reward's owner.
     * @param claimInput The claim input.
     */
    function claimReward(ClaimInput memory claimInput) public {
        _claim(claimInput, claimInput.account);
    }

    /**
     * @notice Claim the reward to other address, but the sender must be reward's owner.
     * @param claimInput The claim input.
     * @param sendToAddress The address to send the reward to.
     */
    function claimRewardToOtherAddress(
        ClaimInput memory claimInput,
        address sendToAddress
    ) public {
        require(
            msg.sender == claimInput.account,
            'RewardDistributor: Invalid account.'
        );
        _claim(claimInput, sendToAddress);
    }
}
