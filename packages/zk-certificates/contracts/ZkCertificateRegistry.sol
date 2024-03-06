// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.7;
pragma abicoder v2;

// OpenZeppelin v4
import {Initializable} from '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

import {SNARK_SCALAR_FIELD} from './helpers/Globals.sol';

import {PoseidonT3} from './helpers/Poseidon.sol';

import {GuardianRegistry, GuardianInfo} from './GuardianRegistry.sol';

import {IZkCertificateRegistry} from './interfaces/IZkCertificateRegistry.sol';

/**
 * @title ZkCertificateRegistry
 * @author Galactica dev team
 * @notice Sparse Merkle Tree for revokable ZK certificates records
 * Relevant external contract calls should be in those functions, not here
 */
contract ZkCertificateRegistry is Initializable, IZkCertificateRegistry {
    // NOTE: The order of instantiation MUST stay the same across upgrades
    // add new variables to the bottom of the list and decrement the __gap
    // variable at the end of this file
    // See https://docs.openzeppelin.com/learn/upgrading-smart-contracts#upgrading

    // a short description to describe the zkCertificate we store in this SC
    // examples: zkKYC, Twitter zkCertificate
    string public description;

    // The tree depth and size
    uint256 internal constant TREE_DEPTH = 32;
    uint256 internal constant TREE_SIZE = 2 ** 32;

    // Tree zero value
    bytes32 public constant ZERO_VALUE =
        bytes32(uint256(keccak256('Galactica')) % SNARK_SCALAR_FIELD);

    // Next leaf index (number of inserted leaves in the current tree)
    uint256 public nextLeafIndex;

    // The Merkle root
    bytes32 public merkleRoot;

    // The Merkle path to the leftmost leaf upon initialization. It *should
    // not* be modified after it has been set by the initialize function.
    // Caching these values is essential to efficient appends.
    bytes32[TREE_DEPTH] public zeros;

    // a mapping to store which Guardian manages which ZkCertificate
    mapping(bytes32 => address) public ZkCertificateToGuardian;

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

    /**
     * @notice Calculates initial values for Merkle Tree
     * @dev OpenZeppelin initializer ensures this can only be called once
     */
    function initializeZkCertificateRegistry(
        address GuardianRegistry_,
        string memory _description
    ) internal onlyInitializing {

    description = _description;
        /*
    To initialize the Merkle tree, we need to calculate the Merkle root
    assuming that each leaf is the zero value.
    H(H(a,b), H(c,d))
      /          \
    H(a,b)     H(c,d)
    /   \       /  \
    a    b     c    d
    `zeros` and `filledSubTrees` will come in handy later when we do
    inserts or updates. e.g when we insert a value in index 1, we will
    need to look up values from those arrays to recalculate the Merkle
    root.
    */

        // Calculate zero values
        zeros[0] = ZERO_VALUE;

        // Store the current zero value for the level we just calculated it for
        bytes32 currentZero = ZERO_VALUE;

        // Loop through each level
        for (uint256 i = 0; i < TREE_DEPTH; i += 1) {
            // Push it to zeros array
            zeros[i] = currentZero;

            // Calculate the zero value for this level
            currentZero = hashLeftRight(currentZero, currentZero);
        }

        // Set merkle root
        merkleRoot = currentZero;
        _GuardianRegistry = GuardianRegistry(GuardianRegistry_);
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
        _changeLeafHash(
            leafIndex,
            currentLeafHash,
            zkCertificateHash,
            merkleProof
        );
        ZkCertificateToGuardian[zkCertificateHash] = msg.sender;
        emit zkCertificateAddition(zkCertificateHash, msg.sender, leafIndex);
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
        _changeLeafHash(leafIndex, zkCertificateHash, newLeafHash, merkleProof);
        ZkCertificateToGuardian[zkCertificateHash] = address(0);
        emit zkCertificateRevocation(zkCertificateHash, msg.sender, leafIndex);
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
            validate(merkleProof, index, currentLeafHash, merkleRoot),
            'merkle proof is not valid'
        );
        // we update the merkle tree accordingly
        merkleRoot = compute(merkleProof, index, newLeafHash);
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
    ) internal pure returns (bool) {
        return (compute(merkleProof, index, leafHash) == _merkleRoot);
    }

    function compute(
        bytes32[] memory merkleProof,
        uint256 index,
        bytes32 leafHash
    ) internal pure returns (bytes32) {
        require(index < TREE_SIZE, '_index bigger than tree size');
        require(merkleProof.length == TREE_DEPTH, 'Invalid _proofs length');

        for (uint256 d = 0; d < TREE_DEPTH; d++) {
            if ((index & 1) == 1) {
                leafHash = hashLeftRight(merkleProof[d], leafHash);
            } else {
                leafHash = hashLeftRight(leafHash, merkleProof[d]);
            }
            index = index >> 1;
        }
        return leafHash;
    }
}
