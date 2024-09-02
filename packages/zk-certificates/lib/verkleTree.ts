/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import keccak256 from 'keccak256';

import { genCoefficients, commit, genProof } from './KZG.ts';
import { hexStringToBigInt, SNARK_SCALAR_FIELD } from './helpers';

type G1Point = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  X: bigint;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Y: bigint;
};

type VerkleProof = {
  verkleProof: G1Point[];
  verkleCommitments: G1Point[];
  index: number;
  leafValue: bigint;
  root: bigint;
};

/*
Each Verkle node contains:
- Value: a G1 point, representing the polynomial commitment. The polynomial is determined by k corresponding Verkle nodes of one level lower, where k is leaf width. All except the last level, whose values are the hashes of ZkCertificate as X coordinates and we will leave the Y values to be 0 because we don't need to calculate them
- Proof: The value used in the verification of the value inside the Langrange polynomial corresponding to the commitment of the node of one level above. For the verkle root the proof is just 0.
*/
type VerkleNode = {
  value: G1Point;
  proof: G1Point;
};

/**
 * Class to manage and construct verkle trees.
 */
export class VerkleTree {
  // Field of the curve used by Poseidon
  field: any;

  // hash value placeholder for empty merkle tree leaves
  emptyLeaf: bigint;

  // Depth of the tree
  depth: number;

  // Width of the tree
  width: number;

  // hashes of empty branches
  emptyBranchLevels: Record<number, VerkleNode>;

  // nodes of the tree as two layers dictionary
  tree: Record<number, Record<number, VerkleNode>>;

  /**
   * Create a VerkleTree.
   * @param depth - Depth of the tree.
   * @param width - Width of the leaf.
   */
  constructor(depth: number, width: number) {
    this.depth = depth;
    this.width = width;
    this.emptyLeaf =
      BigInt(`0x${keccak256('Galactica').toString('hex')}`) %
      SNARK_SCALAR_FIELD;

    // create empty tree
    this.emptyBranchLevels = this.calculateEmptyBranchVerkleNodes(depth);

    // initialize tree dictionary.
    this.tree = {};
    for (let i = 0; i <= depth; i++) {
      this.tree[i] = {};
    }
    // set root
    this.tree[depth][0] = this.emptyBranchLevels[depth];
  }

  /**
   * Retrieve node/leaf at certain index and level of the tree.
   * @param level - Level numbered with depth contains the root.
   * @param index - Index of the leaf in that level.
   * @returns Content of the leaf.
   */
  retrieveLeaf(level: number, index: number): VerkleNode {
    if (level < 0 || level > this.depth) {
      throw new Error(
        `invalid level ${level} inside a tree of depth ${this.depth}`,
      );
    }

    if (index < 0 || index > this.width ** (this.depth - level) - 1) {
      throw new Error(
        `invalid index ${index} at level ${level} inside a tree of depth ${this.depth}`,
      );
    }

    if (this.tree[level][index] === undefined) {
      return this.emptyBranchLevels[level];
    }
    return this.tree[level][index];
  }

  /**
   * Retrieve slice of values of X coordinates at certain level.
   * @param level - Level numbered with depth contains the root.
   * @param startingIndex - Index of the first leaf in the slice.
   * @param endingIndex - Index of the last leaf in the slice.
   * @returns Array of values at the slice.
   */
  retrieveSliceOfXCoordinates(
    level: number,
    startingIndex: number,
    endingIndex: number,
  ): bigint[] {
    const slice: bigint[] = [];
    for (let i = startingIndex; i < endingIndex; i++) {
      slice.push(this.retrieveLeaf(level, i).value.X);
    }
    return slice;
  }

  /**
   * Calculate node hashes for empty branches of all depths.
   * @param depth - Max depth to calculate.
   * @returns Array of VerkleNode for empty branches with [0] being an empty leaf and [depth] being the root.
   */
  calculateEmptyBranchVerkleNodes(depth: number): Record<number, VerkleNode> {
    const levels: Record<number, VerkleNode> = {};

    // depth 0 is just the empty leaf as X value and 0 as Y value
    // we will calculate the proof at the next level
    levels[0] = {
      value: { X: this.emptyLeaf, Y: 0n },
      proof: { X: 0n, Y: 0n },
    };

    for (let i = 1; i <= depth; i++) {
      // in the empty trees all node value are the same so the Lagrange polynomial is just the constant polynomial
      const LagrangePolynomial = [levels[i - 1].value.X];
      const commitment = commit(LagrangePolynomial);
      // the proof, i.e. the commitment of the quotient polynomial, which is just the zero polynomial
      const proof = commit([0n]);
      levels[i - 1].proof = { X: proof[0], Y: proof[1] };
      // again we will calculate proof at the next level
      levels[i] = {
        value: { X: commitment[0], Y: commitment[1] },
        proof: { X: 0n, Y: 0n },
      };
    }

    return levels;
  }

  /**
   * Insert leaves on certain indices into the tree and rebuilds the tree hashes up to the root.
   * A more efficient way would be inserting individual leaves
   * and updating hashes along the path to the root. This is not necessary for the current use case
   * because inserting new leaves into an existing tree is done in the smart contract.
   * Here in the frontend or backend you want to build a new tree from scratch.
   * @param leaves - Array of leaf hashes to insert.
   * @param indices - Array of indices of the leaves to insert.
   */
  insertLeaves(leaves: bigint[], indices: number[]): void {
    if (leaves.length !== indices.length) {
      throw new Error('lengths of leaves and indices have to be equal');
    }
    if (leaves.length === 0) {
      return;
    }
    // insert leaves into new tree
    for (let i = 0; i < leaves.length; i++) {
      // we put the proof to be 0 for now but will update when we calculate the Lagrange polynomial for the next level
      this.tree[0][indices[i]] = {
        value: { X: leaves[i], Y: 0n },
        proof: { X: 0n, Y: 0n },
      };
    }

    // rebuild tree.
    for (let level = 0; level < this.depth; level += 1) {
      // recalculate level above
      for (const index in this.tree[level]) {
        if (this.tree[level][index] !== undefined) {
          const indexNum = Number(index);
          const LagrangePolynomial = genCoefficients(
            this.retrieveSliceOfXCoordinates(
              level,
              indexNum - (indexNum % this.width),
              indexNum - (indexNum % this.width) + this.width,
            ),
          );
          const commitment = commit(LagrangePolynomial);
          const proof = genProof(LagrangePolynomial, indexNum % this.width);
          this.tree[level][index].proof = { X: proof[0], Y: proof[1] };
          // again we leave it 0 for now but will update when we calculate the Lagrange polynomial for the next level
          this.tree[level + 1][Math.floor(indexNum / this.width)] = {
            value: { X: commitment[0], Y: commitment[1] },
            proof: { X: 0n, Y: 0n },
          };
        }
      }
    }
  }

  get root() {
    return this.retrieveLeaf(this.depth, 0).value.X;
  }

  /**
   * Create a merkle proof for a leaf at certain index.
   * @param leafIndex - Index of the leaf at the last level to prove.
   * @returns Verkle proof for the leaf at the index.
   */
  createProof(leafIndex: number): VerkleProof {
    const verkleProof: G1Point[] = [];
    const verkleCommitments: G1Point[] = [];
    const leafValue = this.retrieveLeaf(0, leafIndex).value.X;

    let curIndex = leafIndex;
    // Walk up the tree to the root
    for (let level = 0; level < this.depth; level += 1) {
      const LagrangePolynomial = genCoefficients(
        this.retrieveSliceOfXCoordinates(
          level,
          curIndex - (curIndex % this.width),
          curIndex - (curIndex % this.width) + this.width,
        ),
      );
      // we recalculate the commitment because in the intermediate nodes we only store the X value
      const commitment = commit(LagrangePolynomial);
      verkleCommitments.push({
        X: commitment[0],
        Y: commitment[1],
      });
      const proof = genProof(LagrangePolynomial, curIndex % this.width);
      verkleProof.push({
        X: proof[0],
        Y: proof[1],
      });

      // Get index for next level
      curIndex = Math.floor(curIndex / this.width);
    }

    return {
      verkleProof,
      verkleCommitments,
      index: leafIndex,
      root: this.root,
      leafValue,
    };
  }

  /**
   * Finds the smallest index of an empty leaf.
   * @returns Index of the first empty leaf.
   */
  getFreeLeafIndex(): number {
    const leafIndices: number[] = [];
    for (const index in this.tree[0]) {
      if (Object.prototype.hasOwnProperty.call(this.tree[0], index)) {
        leafIndices.push(Number(index));
      }
    }

    let index = 0;
    // firstly we sort the list of indices
    // Pass sorting function to sort it by the number and not the lexicographical order
    leafIndices.sort((a, b) => a - b);
    // if the list is not empty and the first index is 0 then we proceed to find the gap
    // otherwise the index remains 0
    if (leafIndices.length >= 1 && leafIndices[0] === 0) {
      for (let i = 0; i < leafIndices.length - 1; i++) {
        if (leafIndices[i + 1] - leafIndices[i] >= 2) {
          index = leafIndices[i] + 1;
          break;
        }
      }
      // if the index is not assigned in the for loop yet, i.e. there is no gap in the indices array
      if (index === 0) {
        index = leafIndices[leafIndices.length - 1] + 1;
      }
    }
    return index;
  }

  /**
   * Gets the index of a leaf in the tree.
   * @param leaf - Leaf to check.
   * @returns Index.
   */
  getLeafIndex(leaf: bigint): number {
    for (const index in this.tree[0]) {
      if (Object.prototype.hasOwnProperty.call(this.tree[0], index)) {
        if (this.tree[0][index].value.X === leaf) {
          return Number(index);
        }
      }
    }
    throw new Error('Leaf not found in the tree.');
  }
}
