/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type {
  AnyZkCertContent,
  CEXCertificateContent,
  DEXCertificateContent,
  KYCCertificateContent,
  REYCertificateContent,
  TelegramCertificateContent,
  TwitterCertificateContent,
} from '@galactica-net/galactica-types';
import {
  KnownZkCertStandard,
  contentSchemas,
  parseContentJson,
} from '@galactica-net/galactica-types';
import { expect } from 'chai';
import type { Eddsa } from 'circomlibjs';
import { buildEddsa } from 'circomlibjs';

import cexExample from '../../example/cexFields.json';
import dexExample from '../../example/dexFields.json';
import kycExample from '../../example/kycFields.json';
import kycMinimalExample from '../../example/kycFieldsMinimal.json';
import reyExample from '../../example/reyFields.json';
import simpleJsonExample from '../../example/simpleJsonFields.json';
import telegramExample from '../../example/telegramFields.json';
import twitterExample from '../../example/twitterFields.json';
import { ZkCertificate } from '../../lib';

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
      const zkKYC = new ZkCertificate(
        testHolderCommitment,
        KnownZkCertStandard.ZkKYC,
        eddsa,
        testRandomSalt,
        testExpirationDate,
        contentSchemas.kyc,
        kycExample,
      );

      expect(zkKYC.contentHash).to.equal(
        '13498937448046187479975980844060005602014574276619662435996314654414855730267',
      );
    });

    it('example should be compatible with the schema', async () => {
      expect(() =>
        parseContentJson<KYCCertificateContent>(kycExample, contentSchemas.kyc),
      ).to.not.throw();
    });

    it('minimal example should be valid', async () => {
      expect(() =>
        parseContentJson<KYCCertificateContent>(
          kycMinimalExample,
          contentSchemas.kyc,
        ),
      ).to.not.throw();
    });
  });

  describe('Twitter', () => {
    it('should generate twitter certificate from example', async () => {
      const cert = new ZkCertificate(
        testHolderCommitment,
        KnownZkCertStandard.Twitter,
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

    it('example should be compatible with the schema', async () => {
      expect(() =>
        parseContentJson<TwitterCertificateContent>(
          twitterExample,
          contentSchemas.twitter,
        ),
      ).to.not.throw();
    });
  });

  describe('Rey', () => {
    it('should generate rey cert from example', async () => {
      const zkKYC = new ZkCertificate(
        testHolderCommitment,
        KnownZkCertStandard.Rey,
        eddsa,
        testRandomSalt,
        testExpirationDate,
        contentSchemas.rey,
        reyExample,
      );

      expect(zkKYC.contentHash).to.equal(
        '16796889243774484502652439267275078011091324372566650361683451988345743214827',
      );
    });

    it('example should be compatible with the schema', async () => {
      expect(() =>
        parseContentJson<REYCertificateContent>(reyExample, contentSchemas.rey),
      ).to.not.throw();
    });
  });

  describe('Telegram', () => {
    it('example should be compatible with the schema', async () => {
      expect(() =>
        parseContentJson<TelegramCertificateContent>(
          telegramExample,
          contentSchemas.telegram,
        ),
      ).to.not.throw();
    });
  });

  describe('DEX', () => {
    it('example should be compatible with the schema', async () => {
      expect(() =>
        parseContentJson<DEXCertificateContent>(dexExample, contentSchemas.dex),
      ).to.not.throw();
    });
  });

  describe('CEX', () => {
    it('example should be compatible with the schema', async () => {
      expect(() =>
        parseContentJson<CEXCertificateContent>(cexExample, contentSchemas.cex),
      ).to.not.throw();
    });
  });

  describe('Simple JSON', () => {
    it('example should be compatible with the schema', async () => {
      expect(() =>
        parseContentJson<AnyZkCertContent>(
          simpleJsonExample,
          contentSchemas.simpleJson,
        ),
      ).to.not.throw();
    });
  });

  describe('Content Parsing', () => {
    it('should throw an error if the content does not fit to the schema', async () => {
      expect(() =>
        parseContentJson<KYCCertificateContent>(
          kycExample,
          contentSchemas.twitter,
        ),
      ).to.throw();
    });
  });
});
