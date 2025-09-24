/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { MerkleProof } from '@galactica-net/galactica-types';
import keccak256 from 'keccak256';

import { arrayToBigInt, SNARK_SCALAR_FIELD } from './helpers';

/**
 * Class for managing and constructing merkle trees.
 */

export class SparseMerkleTree {
  // Field of the curve used by Poseidon
  field: any;

  // hash value placeholder for empty merkle tree leaves
  emptyLeaf: string;

  // Depth of the tree
  depth: number;

  // hashes of empty branches
  emptyBranchLevels: string[];

  // nodes of the tree as two layers dictionary
  tree: Record<number, Record<number, string>>;

  // Poseidon instance to use for hashing
  poseidon: any;

  /**
   * Create a MerkleTree.
   *
   * @param depth - Depth of the tree.
   * @param poseidon - Poseidon instance to use for hashing.
   */
  constructor(depth: number, poseidon: any) {
    this.depth = depth;
    this.poseidon = poseidon;
    this.field = poseidon.F;

    this.emptyLeaf = (
      arrayToBigInt(Uint8Array.from(keccak256('Galactica'))) %
      SNARK_SCALAR_FIELD
    ).toString();

    // create empty tree
    this.emptyBranchLevels = this.calculateEmptyBranchHashes(depth);

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
   *
   * @param level - Level numbered with depth contains the root.
   * @param index - Index of the leaf in that level.
   * @returns Content of the leaf.
   */
  retrieveLeaf(level: number, index: number): string {
    if (level < 0 || level > this.depth) {
      throw new Error(
        `invalid level ${level} inside a tree of depth ${this.depth}`,
      );
    }

    if (index < 0 || index > 2 ** (this.depth - level) - 1) {
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
   * Calculate hash of a node from its left and right children.
   *
   * @param left - Left child of the node.
   * @param right - Right child of the node.
   * @returns Hash of the node.
   */
  calculateNodeHash(left: string, right: string): string {
    return this.field.toObject(this.poseidon([left, right])).toString();
  }

  /**
   * Calculate node hashes for empty branches of all depths.
   *
   * @param depth - Max depth to calculate.
   * @returns Array of hashes for empty branches with [0] being an empty leaf and [depth] being the root.
   */
  calculateEmptyBranchHashes(depth: number): string[] {
    const levels: string[] = [];

    // depth 0 is just the empty leaf
    levels.push(this.emptyLeaf);

    for (let i = 1; i <= depth; i++) {
      levels.push(this.calculateNodeHash(levels[i - 1], levels[i - 1]));
    }

    return levels;
  }

  /**
   * Insert a single leaf at a specific index and efficiently update only the nodes along the path to the root.
   * This is much more efficient than rebuilding the entire tree for single insertions.
   *
   * @param leaf - Hash of the leaf to insert.
   * @param index - Index of the leaf to insert.
   */
  insertLeaf(leaf: string, index: number): void {
    let currentLeaf = leaf;
    if (index < 0 || index >= 2 ** this.depth) {
      throw new Error(`invalid index ${index} for tree of depth ${this.depth}`);
    }

    // Insert the leaf at level 0
    this.tree[0][index] = leaf;

    // Update only the nodes along the path to the root
    let currentIndex = index;
    for (let level = 0; level < this.depth; level++) {
      const parentIndex = Math.floor(currentIndex / 2);
      const isLeftChild = currentIndex % 2 === 0;

      if (isLeftChild) {
        // Current node is left child, get right sibling
        const rightSibling = this.retrieveLeaf(level, currentIndex + 1);
        this.tree[level + 1][parentIndex] = this.calculateNodeHash(
          currentLeaf,
          rightSibling,
        );
      } else {
        // Current node is right child, get left sibling
        const leftSibling = this.retrieveLeaf(level, currentIndex - 1);
        this.tree[level + 1][parentIndex] = this.calculateNodeHash(
          leftSibling,
          currentLeaf,
        );
      }

      // Move up to parent level
      currentIndex = parentIndex;
      currentLeaf = this.tree[level + 1][parentIndex];
    }
  }

  /**
   * Insert leaves on certain indices into the tree and rebuilds the tree hashes up to the root.
   *
   * For single leaf insertions, use insertLeaf() which is much more efficient.
   * This method rebuilds the entire tree and is useful for building a tree from scratch.
   *
   * A more efficient way would be inserting individual leaves
   * and updating hashes along the path to the root. This is not necessary for the current use case
   * because inserting new leaves into an existing tree is done in the smart contract.
   * Here in the frontend or backend you want to build a new tree from scratch.
   *
   * @param leaves - Array of leaf hashes to insert.
   * @param indices - Array of indices of the leaves to insert.
   */
  insertLeaves(leaves: string[], indices: number[]): void {
    if (leaves.length !== indices.length) {
      throw new Error('lengths of leaves and indices have to be equal');
    }
    if (leaves.length === 0) {
      return;
    }
    // insert leaves into new tree
    for (let i = 0; i < leaves.length; i++) {
      this.tree[0][indices[i]] = leaves[i];
    }

    // rebuild tree.
    for (let level = 0; level < this.depth; level += 1) {
      // recalculate level above
      for (const index in this.tree[level]) {
        if (this.tree[level][index] !== undefined) {
          const indexNum = Number(index);
          if (indexNum % 2 === 0) {
            this.tree[level + 1][Math.floor(indexNum / 2)] =
              this.calculateNodeHash(
                this.retrieveLeaf(level, indexNum),
                this.retrieveLeaf(level, indexNum + 1),
              );
          } else {
            this.tree[level + 1][Math.floor(indexNum / 2)] =
              this.calculateNodeHash(
                this.retrieveLeaf(level, indexNum - 1),
                this.retrieveLeaf(level, indexNum),
              );
          }
        }
      }
    }
  }

  get root() {
    return this.tree[this.depth][0];
  }

  /**
   * Create a merkle proof for a leaf at certain index.
   *
   * @param leafIndex - Index of the leaf to prove.
   * @returns Merkle proof for the leaf at the index.
   */
  createProof(leafIndex: number): MerkleProof {
    const pathElements = [];
    const leaf = this.retrieveLeaf(0, leafIndex);

    let curIndex = leafIndex;
    // Walk up the tree to the root
    for (let level = 0; level < this.depth; level += 1) {
      // check side we are on
      if (curIndex % 2 === 0) {
        // if the index is even we are on the left and need to get the node from the right
        pathElements.push(this.retrieveLeaf(level, curIndex + 1));
      } else {
        pathElements.push(this.retrieveLeaf(level, curIndex - 1));
        // set bit indicating that we are on the right side of the parent node
      }

      // Get index for next level
      curIndex = Math.floor(curIndex / 2);
    }

    return {
      leaf,
      pathElements,
      leafIndex,
    };
  }

  /**
   * Finds the smallest index of an empty leaf.
   *
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
   *
   * @param leaf - Leaf to check.
   * @returns Index.
   */
  getLeafIndex(leaf: string): number {
    for (const index in this.tree[0]) {
      if (Object.prototype.hasOwnProperty.call(this.tree[0], index)) {
        if (this.tree[0][index] === leaf) {
          return Number(index);
        }
      }
    }
    throw new Error('Leaf not found in the tree.');
  }
}
