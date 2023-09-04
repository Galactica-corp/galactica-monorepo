/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { buildPoseidon } from "circomlibjs";
import { MerkleTree } from "../lib/merkleTree";


/**
 * @description Script for creating a merkle tree for testing from a list of UTXOs
 */
async function main() {
    // Create a new poseidon instance for hashing
    const poseidon = await buildPoseidon();

    // input
    const merkleDepth = 32;  
    const leaves : string[] = [
        "19630604862894493237865119507631642105595355222686969752403793856928034143008",
        "913338630289763938167212770624253461411251029088142596559861590717003723041",
    ];

    // calculate merkle tree
    const merkleTree = new MerkleTree(merkleDepth, poseidon);
    merkleTree.insertLeaves(leaves);

    for (const leaf of leaves) {
        const merkleProof = merkleTree.createProof(leaf);

        // create json output file
        let output = {
            root: merkleTree.root,
            pathIndices: merkleProof.pathIndices,
            pathElements: merkleProof.pathElements,
        }
    
        console.log(`Merkle proof for ${leaf}:\n`, JSON.stringify(output, null, 2));
    }
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});