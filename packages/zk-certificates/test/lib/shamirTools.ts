/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { assert, expect } from 'chai';
import { buildEddsa } from "circomlibjs";
import { reconstructShamirSecret } from '../../lib/shamirTools';


describe('Shamir Tools', () => {
  let eddsa: any;

  before(async () => {
    eddsa = await buildEddsa();
  });

  it('Correctly reconstructs example secret', async () => {
    expect(reconstructShamirSecret(eddsa.F, 3, [
      [2, "1942"],
      [4, "3402"],
      [5, "4414"]
    ])).to.equal("1234");
  });

  it('Fails to reconstruct with wrong inputs', async () => {
    expect(reconstructShamirSecret(eddsa.F, 3, [
      [2, "3490582395892395"],
      [4, "3402"],
      [5, "4414"]
    ])).to.not.equal("1234");
  });

  it('Fails with conflicting inputs', async () => {
    expect(() => reconstructShamirSecret(eddsa.F, 3, [
      [4, "3402"],
      [4, "3402"],
      [5, "4414"]
    ])).to.throw("Share inputs need to be unique");
  });
});
