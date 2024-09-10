/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import {
  reyZkCertificateContentFields,
  twitterZkCertificateContentFields,
  ZkCertStandard,
  zkKYCContentFields,
} from '@galactica-net/galactica-types';
import { expect } from 'chai';
import type { Eddsa } from 'circomlibjs';
import { buildEddsa } from 'circomlibjs';

import kycExample from '../../example/kycFields.json';
import reyExample from '../../example/reyFields.json';
import twitterExample from '../../example/twitterFields.json';
import { ZkCertificate } from '../../lib';
import { prepareZkCertificateFields } from '../../lib/zkCertificateDataProcessing';

describe('ZkCertificate', () => {
  let eddsa: Eddsa;
  const testHolderCommitment = '801635';
  const testRandomSalt = '123';
  const testExpirationDate = 172595;

  before(async () => {
    eddsa = await buildEddsa();
  });

  describe('ZkKYC', () => {
    it('should generate zkKYC from example', async () => {
      const processedFields = prepareZkCertificateFields(
        eddsa,
        kycExample,
        ZkCertStandard.ZkKYC,
      );

      const zkKYC = new ZkCertificate(
        testHolderCommitment,
        ZkCertStandard.ZkKYC,
        eddsa,
        testRandomSalt,
        testExpirationDate,
        zkKYCContentFields,
        processedFields,
      );

      expect(zkKYC.contentHash).to.equal(
        '17914719627421525808158970735216338105805814372033137774126563568134622504748',
      );
    });
  });

  describe('Twitter', () => {
    it('should generate twitter certificate from example', async () => {
      const processedFields = prepareZkCertificateFields(
        eddsa,
        twitterExample,
        ZkCertStandard.Twitter,
      );

      const cert = new ZkCertificate(
        testHolderCommitment,
        ZkCertStandard.Twitter,
        eddsa,
        testRandomSalt,
        testExpirationDate,
        twitterZkCertificateContentFields,
        processedFields,
      );

      expect(cert.contentHash).to.equal(
        '5872577928874538589877684565163333687321666710324086726538479530204757359302',
      );
    });

    it('should handle boolean and 0/1 content the same', async () => {
      const processedFields = prepareZkCertificateFields(
        eddsa,
        twitterExample,
        ZkCertStandard.Twitter,
      );
      processedFields.verified = true;
      const certBoolean = new ZkCertificate(
        testHolderCommitment,
        ZkCertStandard.Twitter,
        eddsa,
        testRandomSalt,
        testExpirationDate,
        twitterZkCertificateContentFields,
        processedFields,
      );
      processedFields.verified = 1;
      const certInt = new ZkCertificate(
        testHolderCommitment,
        ZkCertStandard.Twitter,
        eddsa,
        testRandomSalt,
        testExpirationDate,
        twitterZkCertificateContentFields,
        processedFields,
      );

      expect(certBoolean.contentHash).to.equal(certInt.contentHash);
    });
  });

  describe('Rey', () => {
    it('should generate rey cert from example', async () => {
      const processedFields = prepareZkCertificateFields(
        eddsa,
        reyExample,
        ZkCertStandard.Rey,
      );

      const zkKYC = new ZkCertificate(
        testHolderCommitment,
        ZkCertStandard.Rey,
        eddsa,
        testRandomSalt,
        testExpirationDate,
        reyZkCertificateContentFields,
        processedFields,
      );

      expect(zkKYC.contentHash).to.equal(
        '3421856034079648403282443072620678413551125654918205943007940688743589153558',
      );
    });
  });
});
