/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ZkCertStandard } from '@galactica-net/galactica-types';
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
        processedFields,
      );

      expect(zkKYC.contentHash).to.equal(
        '13498937448046187479975980844060005602014574276619662435996314654414855730267',
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
        processedFields,
      );

      expect(cert.contentHash).to.equal(
        '3879809413317426883258463218760037238791042668884205543118613750992881118378',
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
        processedFields,
      );
      processedFields.verified = 1;
      const certInt = new ZkCertificate(
        testHolderCommitment,
        ZkCertStandard.Twitter,
        eddsa,
        testRandomSalt,
        testExpirationDate,
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
        processedFields,
      );

      expect(zkKYC.contentHash).to.equal(
        '16796889243774484502652439267275078011091324372566650361683451988345743214827',
      );
    });
  });
});
