// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;
pragma abicoder v2;

// OpenZeppelin v4
import {Initializable} from '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import {SNARK_SCALAR_FIELD} from './helpers/Globals.sol';

import {PoseidonT3} from './helpers/Poseidon.sol';

import {GuardianInfo} from './GuardianRegistry.sol';

import {IGuardianRegistry} from './interfaces/IGuardianRegistry.sol';
import {IZkCertificateRegistry} from './interfaces/IZkCertificateRegistry.sol';
import {IReadableZkCertRegistry} from './interfaces/IReadableZkCertRegistry.sol';

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {Fallback} from './helpers/Fallback.sol';
import {ChainAgnosticCalls} from './helpers/ChainAgnosticCalls.sol';

/**
 * @title ZkCertificateRegistry
 * @author Galactica dev team
 * @notice Sparse Merkle Tree for revokable ZK certificates records
 * Relevant external contract calls should be in those functions, not here
 */
contract ZkCertificateRegistry is
    Initializable,
    IZkCertificateRegistry,
    Ownable,
    Fallback,
    ChainAgnosticCalls
{
    // NOTE: The order of instantiation MUST stay the same across upgrades
    // add new variables to the bottom of the list and decrement the __gap
    // variable at the end of this file
    // See https://docs.openzeppelin.com/learn/upgrading-smart-contracts#upgrading

    // a short description to describe the zkCertificate we store in this SC
    // examples: zkKYC, Twitter zkCertificate
    string public description;

    // The tree depth and size
    uint256 public immutable treeDepth;
    uint256 public immutable treeSize;

    // Tree zero value
    bytes32 public constant ZERO_VALUE =
        bytes32(uint256(keccak256('Galactica')) % SNARK_SCALAR_FIELD);

    // array of all merkle roots
    bytes32[] public merkleRoots;
    // and from which index the merkle roots are still valid
    // we start from 1 because nonexistant merkle roots return 0 in the merkleRootIndex mapping
    uint256 public override(IReadableZkCertRegistry) merkleRootValidIndex = 1;
    // we will also store the merkle root index in a mapping for quicker lookup
    mapping(bytes32 => uint)
        public
        override(IReadableZkCertRegistry) merkleRootIndex;

    // Block height at which the contract was initialized
    // You can use it to speed up finding all logs of the contract by starting from this block
    uint256 public initBlockHeight;

    // a mapping to store which Guardian manages which ZkCertificate
    mapping(bytes32 => address) public ZkCertificateToGuardian;
    uint256 public queueExpirationTime = 2 * 60; // Guardian has at 2 minutes to add ZkCertificate after registration to the queue (by default)
    bytes32[] public ZkCertificateQueue;
    uint256 public currentQueuePointer;
    mapping(bytes32 => uint) public ZkCertificateHashToIndexInQueue;
    mapping(bytes32 => uint) public ZkCertificateHashToQueueTime;
    mapping(bytes32 => address) public ZkCertificateHashToCommitedGuardian;

    IGuardianRegistry public override(IReadableZkCertRegistry) guardianRegistry;

    constructor(
        address GuardianRegistry_,
        uint256 treeDepth_,
        string memory description_
    ) initializer Ownable(msg.sender) {
        treeDepth = treeDepth_;
        treeSize = 2 ** treeDepth;
        initializeZkCertificateRegistry(GuardianRegistry_, description_);
    }

    /**
     * @notice return the current merkle root which is the last one in the merkleRoots array
     */
    function merkleRoot()
        public
        view
        override(IReadableZkCertRegistry)
        returns (bytes32)
    {
        return merkleRoots[merkleRoots.length - 1];
    }

    /**
     * @notice return the length of the merkleRoots array
     */
    function merkleRootsLength() external view returns (uint256) {
        return merkleRoots.length;
    }

    /**
     * @notice return the merkle root array starting from _startIndex
     * @param _startIndex The index to start returning roots from
     */
    function getMerkleRoots(
        uint256 _startIndex
    ) public view returns (bytes32[] memory) {
        require(_startIndex < merkleRoots.length, 'Start index out of bounds');

        return getMerkleRoots(_startIndex, merkleRoots.length);
    }

    /**
     * @notice return the merkle root array starting from _startIndex and ending at _endIndex
     * @param _startIndex The index to start returning roots from
     * @param _endIndex The index to end returning roots at
     */
    function getMerkleRoots(
        uint256 _startIndex,
        uint256 _endIndex
    ) public view returns (bytes32[] memory) {
        require(
            _startIndex < _endIndex,
            'Start index must be less than end index'
        );
        require(_endIndex <= merkleRoots.length, 'End index out of bounds');

        uint256 length = _endIndex - _startIndex;
        bytes32[] memory roots = new bytes32[](length);

        for (uint256 i = 0; i < length; i++) {
            roots[i] = merkleRoots[_startIndex + i];
        }

        return roots;
    }

    /**
     * @notice Calculates initial values for Merkle Tree
     * @dev OpenZeppelin initializer ensures this can only be called once
     */
    function initializeZkCertificateRegistry(
        address GuardianRegistry_,
        string memory description_
    ) internal onlyInitializing {
        description = description_;
        /*
        To initialize the Merkle tree, we need to calculate the Merkle root
        assuming that each leaf is the zero value.
        H(H(a,b), H(c,d))
        /          \
        H(a,b)     H(c,d)
        /   \       /  \
        a    b     c    d
        */

        // Store the current zero value for the level we just calculated it for
        bytes32 currentZero = ZERO_VALUE;

        // Loop through each level
        for (uint256 i = 0; i < treeDepth; i += 1) {
            // Calculate the zero value for this level
            currentZero = hashLeftRight(currentZero, currentZero);
        }

        // Set merkle root
        merkleRoots.push(bytes32(0)); // initial root at index 0, not valid because merkleRootIndex(unknown) yields 0
        merkleRoots.push(currentZero); // first valid root at index 1
        merkleRootIndex[currentZero] = 1;
        guardianRegistry = IGuardianRegistry(GuardianRegistry_);

        // Set the block height at which the contract was initialized
        initBlockHeight = getBlockNumber();
    }

    /**
     * @notice Change the time until which the Guardian needs to add/revoke the zkCertificate after registration to the queue
     * @param newTime - New time
     */
    function changeQueueExpirationTime(uint256 newTime) public onlyOwner {
        queueExpirationTime = newTime;
    }

    /**
     * @notice addZkCertificate issues a zkCertificate record by adding it to the Merkle tree
     * @param leafIndex - leaf position of the zkCertificate in the Merkle tree
     * @param zkCertificateHash - hash of the zkCertificate record leaf
     * @param merkleProof - Merkle proof of the zkCertificate record leaf being free
     */
    function addZkCertificate(
        uint256 leafIndex,
        bytes32 zkCertificateHash,
        bytes32[] memory merkleProof
    ) public virtual {
        // since we are adding a new zkCertificate record, we assume that the leaf is of zero value
        bytes32 currentLeafHash = ZERO_VALUE;
        require(
            guardianRegistry.isWhitelisted(msg.sender),
            'ZkCertificateRegistry: not a Guardian'
        );

        require(
            ZkCertificateToGuardian[zkCertificateHash] == address(0),
            'ZkCertificateRegistry: zkCertificate already exists'
        );

        require(
            checkZkCertificateHashInQueue(zkCertificateHash),
            'ZkCertificateRegistry: zkCertificate is not in turn'
        );

        _changeLeafHash(
            leafIndex,
            currentLeafHash,
            zkCertificateHash,
            merkleProof
        );
        ZkCertificateToGuardian[
            zkCertificateHash
        ] = ZkCertificateHashToCommitedGuardian[zkCertificateHash];
        currentQueuePointer =
            ZkCertificateHashToIndexInQueue[zkCertificateHash] +
            1;
        emit zkCertificateAddition(
            zkCertificateHash,
            ZkCertificateToGuardian[zkCertificateHash],
            leafIndex
        );
    }

    /**
     * @notice revokeZkCertificate removes a previously issued zkCertificate from the registry by setting the content of the merkle leaf to zero.
     * @param leafIndex - leaf position of the zkCertificate in the Merkle tree
     * @param zkCertificateHash - hash of the zkCertificate record leaf
     * @param merkleProof - Merkle proof of the zkCertificate record being in the tree
     */
    function revokeZkCertificate(
        uint256 leafIndex,
        bytes32 zkCertificateHash,
        bytes32[] memory merkleProof
    ) public virtual {
        // since we are deleting the content of a leaf, the new value is the zero value
        bytes32 newLeafHash = ZERO_VALUE;
        require(
            ZkCertificateToGuardian[zkCertificateHash] == msg.sender,
            'ZkCertificateRegistry: not the corresponding Guardian'
        );
        require(
            checkZkCertificateHashInQueue(zkCertificateHash),
            'ZkCertificateRegistry: zkCertificate is not in turn'
        );
        _changeLeafHash(leafIndex, zkCertificateHash, newLeafHash, merkleProof);
        // update the valid index
        merkleRootValidIndex = merkleRoots.length - 1;
        currentQueuePointer =
            ZkCertificateHashToIndexInQueue[zkCertificateHash] +
            1;
        emit zkCertificateRevocation(
            zkCertificateHash,
            ZkCertificateToGuardian[zkCertificateHash],
            leafIndex
        );
        ZkCertificateToGuardian[zkCertificateHash] = address(0);
    }

    /** @notice Register a zkCertificate to the queue
     * @param zkCertificateHash - hash of the zkCertificate record leaf
     */
    function registerToQueue(bytes32 zkCertificateHash) public {
        require(
            guardianRegistry.isWhitelisted(msg.sender),
            'ZkCertificateRegistry: not a Guardian'
        );
        // we need to determine the time until which the Guardian needs to add/revoke the zkCertificate after registration to the queue
        uint256 expirationTime;
        // if the pointer is one slot after the end of the queue
        // this means there is no other ZkCertificate pending, so the Guardian has queueExpirationTime from current time
        // the strict inequality should never happen
        if (currentQueuePointer >= ZkCertificateQueue.length) {
            expirationTime = block.timestamp + queueExpirationTime;
            // in the other case there is some other ZkCertificate pending
            // the Guardian has queueExpirationTime after the time of the last registered ZkCertificate
        } else {
            expirationTime =
                ZkCertificateHashToQueueTime[
                    ZkCertificateQueue[ZkCertificateQueue.length - 1]
                ] +
                queueExpirationTime;
        }
        // we register the time and push the zkCertificateHash to the queue
        ZkCertificateHashToQueueTime[zkCertificateHash] = expirationTime;
        ZkCertificateHashToIndexInQueue[zkCertificateHash] = ZkCertificateQueue
            .length;
        ZkCertificateHashToCommitedGuardian[zkCertificateHash] = msg.sender;
        ZkCertificateQueue.push(zkCertificateHash);
    }

    function checkZkCertificateHashInQueue(
        bytes32 zkCertificateHash
    ) public view returns (bool) {
        uint256 index = ZkCertificateHashToIndexInQueue[zkCertificateHash];
        // if the queue pointer points to the zkCertificateHash then the operation can proceed
        require(
            index >= currentQueuePointer,
            'ZkCertificateRegistry: pointer has already passed this zkCertificateHash'
        );
        if (index == currentQueuePointer) {
            return true;
            // if the expiration time of the previous zkCertificateHash has passed
            // the operation can proceed
        } else {
            bytes32 previousZkCertificateHash = ZkCertificateQueue[index - 1];
            return
                ZkCertificateHashToQueueTime[previousZkCertificateHash] <
                block.timestamp;
        }
    }

    /** @notice Function change the leaf content at a certain index
     * @param index the index of the overwritten leaf in the last level
     * @param currentLeafHash the current content of the leaf
     * @param newLeafHash the new content we want to write into the leaf
     * @param merkleProof the merkle sibling path
     **/
    function _changeLeafHash(
        uint256 index,
        bytes32 currentLeafHash,
        bytes32 newLeafHash,
        bytes32[] memory merkleProof
    ) internal {
        require(
            validate(merkleProof, index, currentLeafHash, merkleRoot()),
            'merkle proof is not valid'
        );
        // we update the merkle tree accordingly
        bytes32 newMerkleRoot = compute(merkleProof, index, newLeafHash);
        merkleRoots.push(newMerkleRoot);
        merkleRootIndex[newMerkleRoot] = merkleRoots.length - 1;
    }

    /**
     * @notice Hash 2 uint256 values
     * @param _left - Left side of hash
     * @param _right - Right side of hash
     * @return hash result
     */
    function hashLeftRight(
        bytes32 _left,
        bytes32 _right
    ) public pure returns (bytes32) {
        return PoseidonT3.poseidon([_left, _right]);
    }

    /**
     * @notice function to validate a leaf content at a certain index with its merkle proof against a certain merkle root
     */
    function validate(
        bytes32[] memory merkleProof,
        uint256 index,
        bytes32 leafHash,
        bytes32 _merkleRoot
    ) internal view returns (bool) {
        return (compute(merkleProof, index, leafHash) == _merkleRoot);
    }

    function compute(
        bytes32[] memory merkleProof,
        uint256 index,
        bytes32 leafHash
    ) internal view returns (bytes32) {
        require(index < treeSize, '_index bigger than tree size');
        require(merkleProof.length == treeDepth, 'Invalid _proofs length');

        for (uint256 d = 0; d < treeDepth; d++) {
            if ((index & 1) == 1) {
                leafHash = hashLeftRight(merkleProof[d], leafHash);
            } else {
                leafHash = hashLeftRight(leafHash, merkleProof[d]);
            }
            index = index >> 1;
        }
        return leafHash;
    }

    function verifyMerkleRoot(
        bytes32 _merkleRoot
    ) public view override(IReadableZkCertRegistry) returns (bool) {
        uint _merkleRootIndex = merkleRootIndex[_merkleRoot];
        return _merkleRootIndex >= merkleRootValidIndex;
    }

    // function to return the time parameters of the period where one is allowed to add ZkCertificate
    function getTimeParameters(
        bytes32 zkCertificateHash
    ) public view returns (uint, uint) {
        uint expirationTime = ZkCertificateHashToQueueTime[zkCertificateHash];
        require(
            expirationTime != 0,
            'ZkCertificateRegistry: zkCertificate is not in the queue'
        );
        uint indexInQueue = ZkCertificateHashToIndexInQueue[zkCertificateHash];
        require(
            indexInQueue >= currentQueuePointer,
            'ZkCertificateRegistry: pointer has already passed this zkCertificateHash'
        );
        if (currentQueuePointer == indexInQueue || indexInQueue == 0) {
            return (block.timestamp, expirationTime);
        } else {
            uint startTime = ZkCertificateHashToQueueTime[
                ZkCertificateQueue[indexInQueue - 1]
            ];
            return (startTime, expirationTime);
        }
    }
}
