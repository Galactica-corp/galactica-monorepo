/**
 * Simple struct for a merkle proof
 */
export interface MerkleProof {
    leaf: string;
    // hashes of the branches on the side of the path
    pathElements: string[];
    // interpreted as binary number. If a bit is set, it means that the path is the right part of the parent node.
    pathIndices: number;
    root: string;
}