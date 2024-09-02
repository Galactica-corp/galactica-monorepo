// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.7;
pragma abicoder v2;

// OpenZeppelin v4
import {Initializable} from '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import {SNARK_SCALAR_FIELD} from './helpers/Globals.sol';

import {PoseidonT3} from './helpers/Poseidon.sol';

import {GuardianRegistry, GuardianInfo} from './GuardianRegistry.sol';

import {IZkCertificateRegistry} from './interfaces/IZkCertificateRegistry.sol';

import {Ownable} from './Ownable.sol';

import {Pairing, KZGVerifier} from './KZGVerifier.sol';

/**
 * @title ZkCertificateRegistry
 * @author Galactica dev team
 * @notice Sparse Merkle Tree for revokable ZK certificates records
 * Relevant external contract calls should be in those functions, not here
 */
contract ZkCertificateRegistryVT is Initializable, IZkCertificateRegistry, Ownable, KZGVerifier {
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
    uint256 public immutable leafWidth;

    // Tree zero value
    bytes32 public constant ZERO_VALUE =
        bytes32(uint256(keccak256('Galactica')) % SNARK_SCALAR_FIELD);

    // Next leaf index (number of inserted leaves in the current tree)
    uint256 public nextLeafIndex;

    // array of all merkle roots
    bytes32[] public merkleRoots;
    // and from which index the merkle roots are still valid
    // we start from 1 because nonexistant merkle roots return 0 in the merkleRootIndex mapping
    uint256 public merkleRootValidIndex = 1;
    // we will also store the merkle root index in a mapping for quicker lookup
    mapping(bytes32 => uint) public merkleRootIndex;

    // Block height at which the contract was initialized
    // You can use it to speed up finding all logs of the contract by starting from this block
    uint256 public initBlockHeight;

    // a mapping to store which Guardian manages which ZkCertificate
    mapping(bytes32 => address) public ZkCertificateToGuardian;
    uint256 public queueExpirationTime = 60*60; // Guardian has at least one hour to add ZkCertificate after registration to the queue
    bytes32[] public ZkCertificateQueue;
    uint256 public currentQueuePointer;
    mapping(bytes32 => uint) public ZkCertificateHashToIndexInQueue;
    mapping(bytes32 => uint) public ZkCertificateHashToQueueTime;
    mapping(bytes32 => address) public ZkCertificateHashToCommitedGuardian;

    GuardianRegistry public _GuardianRegistry;
    event zkCertificateAddition(
        bytes32 indexed zkCertificateLeafHash,
        address indexed Guardian,
        uint index
    );
    event zkCertificateRevocation(
        bytes32 indexed zkCertificateLeafHash,
        address indexed Guardian,
        uint index
    );

    constructor(
        address GuardianRegistry_,
        uint256 treeDepth_,
        uint256 leafWidth_,
        string memory description_
    ) initializer Ownable(msg.sender){
        treeDepth = treeDepth_;
        treeSize = 2 ** treeDepth;
        leafWidth = leafWidth_;
        initializeZkCertificateRegistry(GuardianRegistry_, description_);
    }

    /**
     * @notice return the current merkle root which is the last one in the merkleRoots array
     */
    function merkleRoot() public view returns (bytes32) {
        return merkleRoots[merkleRoots.length - 1];
    }

    /**
     * @notice return the whole merkle root array
     */
    function getMerkleRoots() public view returns (bytes32[] memory) {
        return merkleRoots;
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
        merkleRoots.push(currentZero);
        _GuardianRegistry = GuardianRegistry(GuardianRegistry_);

        // Set the block height at which the contract was initialized
        initBlockHeight = block.number;
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
    ) public {
        // since we are adding a new zkCertificate record, we assume that the leaf is of zero value
        bytes32 currentLeafHash = ZERO_VALUE;
        require(
            _GuardianRegistry.isWhitelisted(msg.sender),
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
        ZkCertificateToGuardian[zkCertificateHash] = ZkCertificateHashToCommitedGuardian[zkCertificateHash];
        currentQueuePointer = ZkCertificateHashToIndexInQueue[zkCertificateHash] + 1;
        emit zkCertificateAddition(zkCertificateHash, ZkCertificateToGuardian[zkCertificateHash], leafIndex);
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
    ) public {
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
        currentQueuePointer = ZkCertificateHashToIndexInQueue[zkCertificateHash] + 1;
        emit zkCertificateRevocation(zkCertificateHash, ZkCertificateToGuardian[zkCertificateHash], leafIndex);
        ZkCertificateToGuardian[zkCertificateHash] = address(0);

    }

    /** @notice Register a zkCertificate to the queue
     * @param zkCertificateHash - hash of the zkCertificate record leaf
     */
    function registerToQueue(bytes32 zkCertificateHash) public {
        require(
            _GuardianRegistry.isWhitelisted(msg.sender),
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
            expirationTime = ZkCertificateHashToQueueTime[ZkCertificateQueue[ZkCertificateQueue.length - 1]] + queueExpirationTime;
        }
        // we register the time and push the zkCertificateHash to the queue
        ZkCertificateHashToQueueTime[zkCertificateHash] = expirationTime;
        ZkCertificateHashToIndexInQueue[zkCertificateHash] = ZkCertificateQueue.length;
        ZkCertificateHashToCommitedGuardian[zkCertificateHash] = msg.sender;
        ZkCertificateQueue.push(zkCertificateHash);
    }

    function checkZkCertificateHashInQueue(bytes32 zkCertificateHash) public view returns (bool) {
        uint256 index = ZkCertificateHashToIndexInQueue[zkCertificateHash];
        // if the queue pointer points to the zkCertificateHash then the operation can proceed
        require(index >= currentQueuePointer, 'ZkCertificateRegistry: pointer has already passed this zkCertificateHash');
        if (index == currentQueuePointer) {
            return true;
        // if the expiration time of the previous zkCertificateHash has passed
        // the operation can proceed
        } else {
            bytes32 previousZkCertificateHash = ZkCertificateQueue[index - 1];
            return ZkCertificateHashToQueueTime[previousZkCertificateHash] < block.timestamp;
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

    /**
     Function to validate a leaf value inside the verkle tree
     @param verkleProof - array of the G1 points representing the proofs
     @param verkleCommitments - array of the G1 points representing the polynomial commitments, the last one should be the G2 point with verkle root as x coordinate
     @param index - the index of the leaf in the last level of the tree
     @param leafValue - the value of the leaf
     @param _verkleRoot - the verkle root
     */
    function validateVT(
        Pairing.G1Point[] memory verkleProof,
        Pairing.G1Point[] memory verkleCommitments,
        uint256 index,
        uint leafValue,
        uint _verkleRoot
    ) public view returns (bool) {
        require(verkleProof.length == verkleCommitments.length, "Invalid verkle proof length");
        require(verkleCommitments[verkleCommitments.length - 1].X == _verkleRoot, "Invalid verkle root");
        // we check the polynomial for each level of the tree
        // here 0 is the lowest level and d is the root level
        /* at iteration d with current index, current leafValue we have:
        - Lagrange polynomial p interpolated at the following leafWidth points:
        p(0), p(1), ..., p(leafWidth - 1) is chunk of length leafWidth with values of leaves starting at index "(index - index % leafWidth)"
        Then [p(s)]_1 is verkleCommitment[d]
        - Quotient polynomial: q(x) = (p(x) - current leafValue) / (x - current index)
        Then [q(s)]_1 is verkleProof[d]
        - The function verifyKZG verifies that (in a different equivalent form):
        e(verkleCommitment[d], G2.g) == e(verkleProof[d], [s]_2 - [current index]_2)
        - Afterwards we change the current index and current leafValue to prepare for the next level
        */

        for (uint d = 0; d < treeDepth; d++) {
            uint polynomialIndex = index % leafWidth;
            require(verifyKZG(verkleCommitments[d].X, verkleCommitments[d].Y, verkleProof[d].X, verkleProof[d].Y, polynomialIndex, leafValue), "KZG verification failed");
            leafValue = verkleCommitments[d].X;
            index = index / leafWidth;
        }
        return true;
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

    function verifyMerkleRoot(bytes32 _merkleRoot) public view returns (bool) {
        uint _merkleRootIndex = merkleRootIndex[_merkleRoot];
        return _merkleRootIndex >= merkleRootValidIndex;
    }

    // function to return the time parameters of the period where one is allowed to add ZkCertificate
    function getTimeParameters(bytes32 zkCertificateHash) public view returns (uint, uint) {
        uint expirationTime = ZkCertificateHashToQueueTime[zkCertificateHash];
        require(expirationTime != 0, "ZkCertificateRegistry: zkCertificate is not in the queue");
        uint indexInQueue = ZkCertificateHashToIndexInQueue[zkCertificateHash];
        require(indexInQueue >= currentQueuePointer, 'ZkCertificateRegistry: pointer has already passed this zkCertificateHash');
        if (currentQueuePointer == indexInQueue || indexInQueue == 0) {
            return (block.timestamp, expirationTime);
        } else {
            uint startTime = ZkCertificateHashToQueueTime[ZkCertificateQueue[indexInQueue - 1]];
            return (startTime, expirationTime);
        }
    }
}
