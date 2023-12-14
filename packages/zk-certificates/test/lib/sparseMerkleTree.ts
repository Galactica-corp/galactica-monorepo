/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { expect } from 'chai';
import type { Eddsa } from 'circomlibjs';
import { buildEddsa } from 'circomlibjs';

import { SparseMerkleTree } from '../../lib/sparseMerkleTree';

describe('Sparse Merkle Tree', () => {
  let eddsa: Eddsa;

  before(async () => {
    eddsa = await buildEddsa();
  });

  it('finds empty leaf indices', async () => {
    const merkleTree = new SparseMerkleTree(32, eddsa.poseidon);
    expect(merkleTree.getFreeLeafIndex()).to.equal(0);

    let indices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    merkleTree.insertLeaves(
      indices.map((index) => index.toString()),
      indices,
    );
    expect(merkleTree.getFreeLeafIndex()).to.equal(11);

    indices = [11, 12, 14];
    merkleTree.insertLeaves(
      indices.map((index) => index.toString()),
      indices,
    );
    expect(merkleTree.getFreeLeafIndex()).to.equal(13);
  });
});
