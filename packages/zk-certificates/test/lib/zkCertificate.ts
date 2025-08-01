/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { AnyZkCertContent, CEXCertificateContent, DEXCertificateContent, KYCCertificateContent, REYCertificateContent, TelegramCertificateContent, TwitterCertificateContent, ZkCertStandard, contentSchemas } from '@galactica-net/galactica-types';
import Ajv from 'ajv';
import { expect } from 'chai';
import type { Eddsa } from 'circomlibjs';
import { buildEddsa } from 'circomlibjs';
import { ZkCertificate } from '../../lib';

import kycExample from '../../example/kycFields.json';
import kycMinimalExample from '../../example/kycFieldsMinimal.json';
import reyExample from '../../example/reyFields.json';
import twitterExample from '../../example/twitterFields.json';
import telegramExample from '../../example/telegramFields.json';
import dexExample from '../../example/dexFields.json';
import cexExample from '../../example/cexFields.json';
import simpleJsonExample from '../../example/simpleJsonFields.json';

describe('ZkCertificate', () => {
  let eddsa: Eddsa;
  const testHolderCommitment = '801635';
  const testRandomSalt = '123';
  const testExpirationDate = 172595;

  before(async () => {
    eddsa = await buildEddsa();
  });

  function validateContent<ContentType>(content: any, schema: any) {
    const ajv = new Ajv();
    ajv.addSchema(schema);
    const validate = ajv.compile<ContentType>(schema);
    const valid = validate(content);
    expect(valid).to.be.true;
  }

  describe('ZkKYC', () => {
    it('should generate zkKYC from example', async () => {
      const zkKYC = new ZkCertificate(
        testHolderCommitment,
        ZkCertStandard.ZkKYC,
        eddsa,
        testRandomSalt,
        testExpirationDate,
        contentSchemas.kyc,
        kycExample as KYCCertificateContent,
      );

      expect(zkKYC.contentHash).to.equal(
        '13498937448046187479975980844060005602014574276619662435996314654414855730267',
      );
    });

    it('example should be compatible with the schema', async () => {
      validateContent<KYCCertificateContent>(kycExample, contentSchemas.kyc);
    });

    it('minimal example should be valid', async () => {
      validateContent<KYCCertificateContent>(kycMinimalExample, contentSchemas.kyc);
    });
  });

  describe('Twitter', () => {
    it('should generate twitter certificate from example', async () => {
      const cert = new ZkCertificate(
        testHolderCommitment,
        ZkCertStandard.Twitter,
        eddsa,
        testRandomSalt,
        testExpirationDate,
        contentSchemas.twitter,
        twitterExample,
      );

      expect(cert.contentHash).to.equal(
        '18440353611057365870866333183021390856009212978008943705414375548803741765956',
      );
    });

    it('should handle boolean and 0/1 content the same', async () => {
      let booleanContent = JSON.parse(JSON.stringify(twitterExample));
      booleanContent.verified = true;
      const certBoolean = new ZkCertificate(
        testHolderCommitment,
        ZkCertStandard.Twitter,
        eddsa,
        testRandomSalt,
        testExpirationDate,
        contentSchemas.twitter,
        booleanContent,
      );
      let intContent = JSON.parse(JSON.stringify(twitterExample));
      intContent.verified = 1;
      const certInt = new ZkCertificate(
        testHolderCommitment,
        ZkCertStandard.Twitter,
        eddsa,
        testRandomSalt,
        testExpirationDate,
        contentSchemas.twitter,
        intContent,
      );

      expect(certBoolean.contentHash).to.equal(certInt.contentHash);
    });

    it('example should be compatible with the schema', async () => {
      validateContent<TwitterCertificateContent>(twitterExample, contentSchemas.twitter);
    });
  });

  describe('Rey', () => {
    it('should generate rey cert from example', async () => {
      const zkKYC = new ZkCertificate(
        testHolderCommitment,
        ZkCertStandard.Rey,
        eddsa,
        testRandomSalt,
        testExpirationDate,
        contentSchemas.rey,
        reyExample as REYCertificateContent,
      );

      expect(zkKYC.contentHash).to.equal(
        '16796889243774484502652439267275078011091324372566650361683451988345743214827',
      );
    });

    it('example should be compatible with the schema', async () => {
      validateContent<REYCertificateContent>(reyExample, contentSchemas.rey);
    });
  });

  describe('Telegram', () => {
    it('example should be compatible with the schema', async () => {
      validateContent<TelegramCertificateContent>(telegramExample, contentSchemas.telegram);
    });
  });

  describe('DEX', () => {
    it('example should be compatible with the schema', async () => {
      validateContent<DEXCertificateContent>(dexExample, contentSchemas.dex);
    });
  });

  describe('CEX', () => {
    it('example should be compatible with the schema', async () => {
      validateContent<CEXCertificateContent>(cexExample, contentSchemas.cex);
    });
  });

  describe('Simple JSON', () => {
    it('example should be compatible with the schema', async () => {
      validateContent<AnyZkCertContent>(simpleJsonExample, contentSchemas.simpleJson);
    });
  });
});