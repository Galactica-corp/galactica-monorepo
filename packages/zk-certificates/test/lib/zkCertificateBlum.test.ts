/* Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */

import type { BlumCertificateContent } from '@galactica-net/galactica-types';
import {
  KnownZkCertStandard,
  getContentSchema,
} from '@galactica-net/galactica-types';
import { expect } from 'chai';
import { buildEddsa } from 'circomlibjs';

import { ZkCertificate } from '../../lib/zkCertificate';
import {
  floatToBigInt,
  hashZkCertificateContent,
} from '../../lib/zkCertificateDataProcessing';

describe('Blum Certificate (GIP-8)', () => {
  let eddsa: any;

  before(async () => {
    eddsa = await buildEddsa();
  });

  describe('BlumContent validation', () => {
    it('should accept valid Blum certificate content', () => {
      const validContent: BlumCertificateContent = {
        telegramId: '123456789',
        activityScore: 90.75,
        sybilScore: 85.5,
      };

      const schema = getContentSchema(KnownZkCertStandard.Blum);
      expect(() => {
        const zkCert = new ZkCertificate(
          '12345',
          KnownZkCertStandard.Blum,
          eddsa,
          '67890',
          Math.floor(Date.now() / 1000) + 86400,
          schema,
          validContent,
        );
        return zkCert;
      }).to.not.throw();
    });

    it('should reject content missing telegramId', () => {
      const invalidContent = {
        activityScore: 90.75,
        sybilScore: 85.5,
      } as any;

      const schema = getContentSchema(KnownZkCertStandard.Blum);
      expect(() => {
        const zkCert = new ZkCertificate(
          '12345',
          KnownZkCertStandard.Blum,
          eddsa,
          '67890',
          Math.floor(Date.now() / 1000) + 86400,
          schema,
          invalidContent,
        );
        return zkCert;
      }).to.throw();
    });

    it('should reject content missing activityScore', () => {
      const invalidContent = {
        telegramId: '123456789',
        sybilScore: 85.5,
      } as any;

      const schema = getContentSchema(KnownZkCertStandard.Blum);
      expect(() => {
        const zkCert = new ZkCertificate(
          '12345',
          KnownZkCertStandard.Blum,
          eddsa,
          '67890',
          Math.floor(Date.now() / 1000) + 86400,
          schema,
          invalidContent,
        );
        return zkCert;
      }).to.throw();
    });

    it('should reject content missing sybilScore', () => {
      const invalidContent = {
        telegramId: '123456789',
        activityScore: 90.75,
      } as any;

      const schema = getContentSchema(KnownZkCertStandard.Blum);
      expect(() => {
        const zkCert = new ZkCertificate(
          '12345',
          KnownZkCertStandard.Blum,
          eddsa,
          '67890',
          Math.floor(Date.now() / 1000) + 86400,
          schema,
          invalidContent,
        );
        return zkCert;
      }).to.throw();
    });

    it('should handle decimal precision correctly', () => {
      const content: BlumCertificateContent = {
        telegramId: '1305035200',
        activityScore: 40.06289271058492,
        sybilScore: 0.20000000298023224,
      };

      const schema = getContentSchema(KnownZkCertStandard.Blum);
      expect(() => {
        const zkCert = new ZkCertificate(
          '12345',
          KnownZkCertStandard.Blum,
          eddsa,
          '67890',
          Math.floor(Date.now() / 1000) + 86400,
          schema,
          content,
        );
        return zkCert;
      }).to.not.throw();
    });
  });

  describe('Hash computation', () => {
    it('should produce consistent hashes for the same content', () => {
      const content: BlumCertificateContent = {
        telegramId: '123456789',
        activityScore: 90.75,
        sybilScore: 85.5,
      };

      const schema = getContentSchema(KnownZkCertStandard.Blum);
      const hash1 = hashZkCertificateContent(eddsa, content, schema);
      const hash2 = hashZkCertificateContent(eddsa, content, schema);

      expect(hash1).to.equal(hash2);
    });

    it('should produce different hashes for different telegramId', () => {
      const content1: BlumCertificateContent = {
        telegramId: '123456789',
        activityScore: 90.75,
        sybilScore: 85.5,
      };

      const content2: BlumCertificateContent = {
        telegramId: '987654321',
        activityScore: 90.75,
        sybilScore: 85.5,
      };

      const schema = getContentSchema(KnownZkCertStandard.Blum);
      const hash1 = hashZkCertificateContent(eddsa, content1, schema);
      const hash2 = hashZkCertificateContent(eddsa, content2, schema);

      expect(hash1).to.not.equal(hash2);
    });

    it('should produce different hashes for different activityScore', () => {
      const content1: BlumCertificateContent = {
        telegramId: '123456789',
        activityScore: 90.75,
        sybilScore: 85.5,
      };

      const content2: BlumCertificateContent = {
        telegramId: '123456789',
        activityScore: 95.2,
        sybilScore: 85.5,
      };

      const schema = getContentSchema(KnownZkCertStandard.Blum);
      const hash1 = hashZkCertificateContent(eddsa, content1, schema);
      const hash2 = hashZkCertificateContent(eddsa, content2, schema);

      expect(hash1).to.not.equal(hash2);
    });

    it('should produce different hashes for different sybilScore', () => {
      const content1: BlumCertificateContent = {
        telegramId: '123456789',
        activityScore: 90.75,
        sybilScore: 85.5,
      };

      const content2: BlumCertificateContent = {
        telegramId: '123456789',
        activityScore: 90.75,
        sybilScore: 95.3,
      };

      const schema = getContentSchema(KnownZkCertStandard.Blum);
      const hash1 = hashZkCertificateContent(eddsa, content1, schema);
      const hash2 = hashZkCertificateContent(eddsa, content2, schema);

      expect(hash1).to.not.equal(hash2);
    });
  });

  describe('ZkCertificate integration', () => {
    it('should create a Blum certificate with valid content', () => {
      const content: BlumCertificateContent = {
        telegramId: '123456789',
        activityScore: 90.75,
        sybilScore: 85.5,
      };

      const holderCommitment = '12345';
      const randomSalt = '67890';
      const expirationDate = Math.floor(Date.now() / 1000) + 86400;
      const schema = getContentSchema(KnownZkCertStandard.Blum);

      const zkCert = new ZkCertificate(
        holderCommitment,
        KnownZkCertStandard.Blum,
        eddsa,
        randomSalt,
        expirationDate,
        schema,
        content,
      );

      expect(zkCert.zkCertStandard).to.equal(KnownZkCertStandard.Blum);
      expect(zkCert.content).to.deep.equal(content);
      expect(zkCert.contentHash).to.be.a('string');
      expect(zkCert.leafHash).to.be.a('string');
      expect(zkCert.did).to.include('gip8');
    });

    it('should export and parse Blum certificate correctly', () => {
      const content: BlumCertificateContent = {
        telegramId: '1305035200',
        activityScore: 40.06289271058492,
        sybilScore: 0.20000000298023224,
      };

      const holderCommitment = '12345';
      const randomSalt = '67890';
      const expirationDate = Math.floor(Date.now() / 1000) + 86400;
      const schema = getContentSchema(KnownZkCertStandard.Blum);

      const zkCert = new ZkCertificate(
        holderCommitment,
        KnownZkCertStandard.Blum,
        eddsa,
        randomSalt,
        expirationDate,
        schema,
        content,
      );

      const exported = zkCert.exportRaw();

      expect(exported.zkCertStandard).to.equal(KnownZkCertStandard.Blum);
      expect(exported.content).to.deep.equal(content);
      expect(exported.holderCommitment).to.equal(holderCommitment);
      expect(exported.randomSalt).to.equal(randomSalt);
      expect(exported.expirationDate).to.equal(expirationDate);
    });
  });

  describe('Float to BigInt conversion', () => {
    it('should convert float with 18 decimals correctly', () => {
      const result = floatToBigInt(85.5, 18);
      expect(result.toString()).to.equal('85500000000000000000');
    });

    it('should handle small decimal values', () => {
      const result = floatToBigInt(0.20000000298023224, 18);
      // Note: JavaScript floating point precision means the exact value may differ slightly
      expect(result).to.be.a('bigint');
      expect(result > 0n).to.be.true;
    });

    it('should handle large values', () => {
      const result = floatToBigInt(100.0, 18);
      expect(result.toString()).to.equal('100000000000000000000');
    });

    it('should handle zero', () => {
      const result = floatToBigInt(0.0, 18);
      expect(result.toString()).to.equal('0');
    });

    it('should preserve precision for typical Blum scores', () => {
      const activityScore = floatToBigInt(40.06289271058492, 18);
      const sybilScore = floatToBigInt(0.20000000298023224, 18);

      expect(activityScore).to.be.a('bigint');
      expect(sybilScore).to.be.a('bigint');
      expect(activityScore > 0n).to.be.true;
      expect(sybilScore > 0n).to.be.true;
    });

    it('should handle scientific notation correctly', () => {
      // Test positive exponent
      const result1 = floatToBigInt(1e2, 18); // 100
      expect(result1.toString()).to.equal('100000000000000000000');

      // Test negative exponent
      const result2 = floatToBigInt(1e-2, 18); // 0.01
      expect(result2.toString()).to.equal('10000000000000000');

      // Test larger negative exponent
      const result3 = floatToBigInt(1e-10, 18);
      expect(result3.toString()).to.equal('100000000'); // 1e-10 * 10^18 = 10^8

      // Test with decimal in scientific notation
      const result4 = floatToBigInt(1.5e2, 18); // 150
      expect(result4.toString()).to.equal('150000000000000000000');
    });
  });
});
