import { AbiCoder, keccak256 } from "ethers";

export interface IMerkleLeaf {
  index: bigint;
  address: string;
  amount: bigint;
  proof: string[];
}

export interface IMerkleNode {
  hash: string;
  siblingHash: string;
  parentIndex: number;
}

export class MerkleTree {

  nodes: IMerkleNode[] = [];
  leaves: IMerkleLeaf[] = [];
  merkleRootHash: string = "";

  calculatePairHash(hash1: string, hash2: string) {
    let combinedHash: string;

    // using the same mathod as in OpenZeppeling MerkleProof function
    if (hash1 <= hash2) {
      combinedHash = AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [BigInt(hash1), BigInt(hash2)]);
    } else {
      combinedHash = AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [BigInt(hash2), BigInt(hash1)]);
    }
    return keccak256(combinedHash);
  }

  buildMerkleTreeForRewardsDistribution(elements: IMerkleLeaf[]) {

    elements = elements.sort((a, b) => {
      if (a.index < b.index) {
        return -1;
      }
      if (a.index > b.index) {
        return 1;
      }
      return 0;
    });

    for (let i = 0; i < elements.length; i++) {
      // this should be the same hash computation as in RewardDistributor smart contract
      const payloadLeaf = AbiCoder.defaultAbiCoder().encode(["uint256", "address", "uint256"], [elements[i].index, elements[i].address, elements[i].amount]);
      const hashLeaf = keccak256(payloadLeaf);
      this.nodes.push({ hash: hashLeaf, siblingHash: "", parentIndex: -1 });
      this.leaves.push(elements[i]);
    }

    let currNode = 0;
    // while we have at least two nodes without parent
    //    we will merge currNode with node (currNode+1) and add their parent to the end of nodes array
    while (currNode + 1 < this.nodes.length) {
      const sibling = currNode + 1;

      const currHash = this.nodes[currNode].hash;
      const siblingHash = this.nodes[sibling].hash;

      this.nodes[currNode].siblingHash = siblingHash;
      this.nodes[sibling].siblingHash = currHash;

      const hashParent = this.calculatePairHash(currHash, siblingHash);

      this.nodes.push({ hash: hashParent, siblingHash: "", parentIndex: -1 });

      this.nodes[currNode].parentIndex = this.nodes.length - 1;
      this.nodes[sibling].parentIndex = this.nodes.length - 1;

      currNode += 2;
    }

    // root is the last added node
    this.merkleRootHash = this.nodes[this.nodes.length - 1].hash;
  }

  getProof(index: number): string[] {
    const proof: string[] = [];

    while (this.nodes[index].parentIndex != -1) {
      proof.push(this.nodes[index].siblingHash);
      index = this.nodes[index].parentIndex;
    }

    return proof;
  }

  calcAllMerkleProofs(): IMerkleLeaf[] {
    for (let i = 0; i < this.leaves.length; i++) {
      this.leaves[i].proof = this.getProof(i);
    }
    return this.leaves;
  }
}

