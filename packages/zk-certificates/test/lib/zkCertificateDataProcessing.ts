/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { expect } from 'chai';
import type { Eddsa } from 'circomlibjs';
import { buildEddsa } from 'circomlibjs';
import kycExample from '../../example/kycFields.json';
import reyExample from '../../example/reyFields.json';
import twitterExample from '../../example/twitterFields.json';
import { prepareZkCertificateFields, dateStringToUnixTimestamp } from '../../lib/zkCertificateDataProcessing';
import { ZkCertStandard } from '@galactica-net/galactica-types';


describe('ZK Certificate Data Processing', () => {
  let eddsa: Eddsa;

  before(async () => {
    eddsa = await buildEddsa();
  });

  describe('Examples', () => {
    it('should process kyc example', async () => {
      const processed = prepareZkCertificateFields(eddsa, kycExample, ZkCertStandard.ZkKYC);

      // check that all string fields have been hashed by checking that all remaining strings are numbers
      for (const field of Object.keys(processed)) {
        if (typeof processed[field] === 'string') {
          expect(processed[field]).to.match(/^[0-9]+$/);
        }
      }
    });

    it('should process twitter example', async () => {
      const processed = prepareZkCertificateFields(eddsa, twitterExample, ZkCertStandard.Twitter);

      expect(processed["username"]).to.match(/^[0-9]+$/);
      expect(processed["createdAt"]).to.match(/^[0-9]+$/);
    });

    it('should process rey example', async () => {
      const processed = prepareZkCertificateFields(eddsa, reyExample, ZkCertStandard.Rey);

      expect(processed["x_username"]).to.match(/^[0-9]+$/);
    });
  });

  describe('Date Processing', () => {
    it('should process RCF339', async () => {
      const res = dateStringToUnixTimestamp("2024-09-10T09:15:44+00:00");
      expect(res).to.equal(1725959744);
    });

    it('should process unix string', async () => {
      const res = dateStringToUnixTimestamp("1725959769");
      expect(res).to.equal(1725959769);
    });
  });
});
