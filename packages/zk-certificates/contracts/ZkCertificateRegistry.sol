// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;
pragma abicoder v2;

import {SNARK_SCALAR_FIELD} from './helpers/Globals.sol';
import {PoseidonT3} from './helpers/Poseidon.sol';
import {GuardianInfo} from './GuardianRegistry.sol';

import {IGuardianRegistry} from './interfaces/IGuardianRegistry.sol';
import {IZkCertificateRegistry} from './interfaces/IZkCertificateRegistry.sol';
import {IReadableZkCertRegistry} from './interfaces/IReadableZkCertRegistry.sol';
import {IWritableZKCertRegistry, CertificateData, RegistryOperation, CertificateState} from './interfaces/IWritableZKCertRegistry.sol';

import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import {Ownable2StepUpgradeable} from '@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol';
import {Fallback} from './helpers/Fallback.sol';
import {ChainAgnosticCalls} from './helpers/ChainAgnosticCalls.sol';

/**
 * @title ZkCertificateRegistry
 * @author Galactica dev team
 * @notice Sparse Merkle Tree for revokable ZK certificates records
 * Relevant external contract calls should be in those functions, not here
 */
contract ZkCertificateRegistry is
    IZkCertificateRegistry,
    Ownable2StepUpgradeable,
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
    uint256 public treeDepth;
    uint256 public treeSize;

    // Tree zero value
    bytes32 public constant ZERO_VALUE =
        bytes32(uint256(keccak256('Galactica')) % SNARK_SCALAR_FIELD);

    // array of all merkle roots
    bytes32[] public merkleRoots;
    // and from which index the merkle roots are still valid
    // all previous ones are invalid because they contain revoked certificates
    // we start from 1 because nonexistant merkle roots return 0 in the merkleRootIndex mapping
    uint256 public override(IReadableZkCertRegistry) merkleRootValidIndex = 1;
    // we will also store the merkle root index in a mapping for quicker lookup
    mapping(bytes32 => uint256)
        public
        override(IReadableZkCertRegistry) merkleRootIndex;

    // Block height at which the contract was initialized
    // You can use it to speed up finding all logs of the contract by starting from this block
    uint256 public initBlockHeight;

    bytes32[] public ZkCertificateQueue;
    uint256 public currentQueuePointer;

    mapping(bytes32 => CertificateData) public zkCertificateHashToData;

    IGuardianRegistry public override(IReadableZkCertRegistry) guardianRegistry;

    constructor() {
        // not used because the contract is behind a proxy and needs to be initialized instead
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract with this function because a smart contract behind a proxy can't have a constructor.
     * @param GuardianRegistry_ Address of the guardian registry.
     * @param treeDepth_ Depth of the Merkle tree.
     * @param description_ Description of the zkCertificate registry.
     */
    function initialize(
        address GuardianRegistry_,
        uint256 treeDepth_,
        string memory description_
    ) public virtual initializer {
        treeDepth = treeDepth_;
        treeSize = 2 ** treeDepth;
        initializeZkCertificateRegistry(GuardianRegistry_, description_);
        __Ownable_init(msg.sender);
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
        // This helps indexers to query all logs of the contract by starting from this block
        initBlockHeight = getBlockNumber();
    }

    /**
     * @notice Process the next operation from the queue to add or revoke a zkCertificate.
     * @dev This function may be called by anyone to process certificates added to the queue by guardians.
     * @param leafIndex - Leaf position of the zkCertificate in the Merkle tree.
     * @param zkCertificateHash - Hash of the zkCertificate record leaf.
     * @param merkleProof - Merkle proof of the zkCertificate record leaf being free.
     */
    function processNextOperation(
        uint256 leafIndex,
        bytes32 zkCertificateHash,
        bytes32[] memory merkleProof
    ) external {
        require(
            isZkCertificateInTurn(zkCertificateHash),
            'ZkCertificateRegistry: zkCertificate is not in turn to be processed'
        );

        if (
            zkCertificateHashToData[zkCertificateHash].state ==
            CertificateState.IssuanceQueued
        ) {
            // since we are adding a new zkCertificate record, we assume that the leaf is of zero value
            bytes32 currentLeafHash = ZERO_VALUE;
            _changeLeafHash(
                leafIndex,
                currentLeafHash,
                zkCertificateHash,
                merkleProof
            );

            zkCertificateHashToData[zkCertificateHash].state = CertificateState
                .Issued;

            emit CertificateProcessed(
                zkCertificateHash,
                zkCertificateHashToData[zkCertificateHash].guardian,
                RegistryOperation.Add,
                zkCertificateHashToData[zkCertificateHash].queueIndex,
                leafIndex
            );
        } else if (
            zkCertificateHashToData[zkCertificateHash].state ==
            CertificateState.RevocationQueued
        ) {
            // since we are deleting the content of a leaf, the new value is the zero value
            bytes32 newLeafHash = ZERO_VALUE;
            _changeLeafHash(
                leafIndex,
                zkCertificateHash,
                newLeafHash,
                merkleProof
            );

            // Update the valid index. Previous ones are invalid because they contain the revoked certificate.
            merkleRootValidIndex = merkleRoots.length - 1;

            zkCertificateHashToData[zkCertificateHash].state = CertificateState
                .Revoked;

            emit CertificateProcessed(
                zkCertificateHash,
                zkCertificateHashToData[zkCertificateHash].guardian,
                RegistryOperation.Revoke,
                zkCertificateHashToData[zkCertificateHash].queueIndex,
                leafIndex
            );
        } else {
            revert(
                'ZkCertificateRegistry: processing invalid operation. This should not happen.'
            );
        }

        currentQueuePointer += 1;
    }

    /** @notice Register an operation about a zkCertificate to the queue.
     * @param zkCertificateHash - Hash of the zkCertificate record leaf.
     * @param operation - Operation to add to the queue.
     */
    function addOperationToQueue(
        bytes32 zkCertificateHash,
        RegistryOperation operation
    ) public virtual {
        require(
            guardianRegistry.isWhitelisted(msg.sender),
            'ZkCertificateRegistry: not a Guardian'
        );

        if (operation == RegistryOperation.Add) {
            require(
                zkCertificateHashToData[zkCertificateHash].state ==
                    CertificateState.NonExistent,
                'ZkCertificateRegistry: zkCertificate already exists'
            );
            zkCertificateHashToData[zkCertificateHash].state = CertificateState
                .IssuanceQueued;
        } else if (operation == RegistryOperation.Revoke) {
            require(
                zkCertificateHashToData[zkCertificateHash].state ==
                    CertificateState.Issued,
                'ZkCertificateRegistry: zkCertificate is not issued and can therefore not be revoked'
            );
            require(
                zkCertificateHashToData[zkCertificateHash].guardian ==
                    msg.sender,
                'ZkCertificateRegistry: not the corresponding Guardian'
            );
            zkCertificateHashToData[zkCertificateHash].state = CertificateState
                .RevocationQueued;
        } else {
            revert('ZkCertificateRegistry: invalid operation');
        }

        zkCertificateHashToData[zkCertificateHash]
            .queueIndex = ZkCertificateQueue.length;
        zkCertificateHashToData[zkCertificateHash].guardian = msg.sender;

        ZkCertificateQueue.push(zkCertificateHash);

        emit OperationQueued(
            zkCertificateHash,
            msg.sender,
            operation,
            zkCertificateHashToData[zkCertificateHash].queueIndex
        );
    }

    /**
     * @notice Check if a zkCertificate is in turn to be processed.
     * @param zkCertificateHash - Hash of the zkCertificate record leaf.
     * @return True if the zkCertificate is in turn, false otherwise.
     */
    function isZkCertificateInTurn(
        bytes32 zkCertificateHash
    ) public view returns (bool) {
        return (zkCertificateHashToData[zkCertificateHash].queueIndex ==
            currentQueuePointer);
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

    /**
     * @notice Get the length of the queue.
     * @return The length of the queue.
     */
    function getZkCertificateQueueLength() public view returns (uint256) {
        return ZkCertificateQueue.length;
    }

    /**
     * @notice Get the position of a zkCertificate in the queue.
     * @param zkCertificateHash - Hash of the zkCertificate record leaf.
     * @return The position of the zkCertificate in the queue.
     */
    function getQueuePosition(
        bytes32 zkCertificateHash
    ) public view returns (uint256) {
        return zkCertificateHashToData[zkCertificateHash].queueIndex;
    }

    /**
     * @notice Get the data of a zkCertificate needed to process it.
     * @param zkCertificateHash - Hash of the zkCertificate record leaf.
     * @return The data of the zkCertificate needed to process it.
     */
    function zkCertificateProcessingData(
        bytes32 zkCertificateHash
    ) public view returns (CertificateData memory) {
        return zkCertificateHashToData[zkCertificateHash];
    }
}
