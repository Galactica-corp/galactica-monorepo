import { expect } from 'chai';

import kycFields from '../../zk-certificates/example/kycFields.json';
import {
  ZkCertStandard,
  getContentFields,
  getContentSchema,
  parseContentJson,
} from '../src/zkCertStandard';

describe('ZkCertStandard', () => {
  describe('getContentFields', () => {
    it('should return sorted fields for ZkKYC', () => {
      const fields = getContentFields(ZkCertStandard.ZkKYC);
      const expectedFields = [
        'citizenship',
        'country',
        'dayOfBirth',
        'forename',
        'middlename',
        'monthOfBirth',
        'postcode',
        'region',
        'streetAndNumber',
        'surname',
        'town',
        'verificationLevel',
        'yearOfBirth',
      ];
      expect(fields).to.deep.equal(expectedFields);
    });
  });

  describe('JSON schema formats', () => {
    it('should accept valid country and empty region', () => {
      const schema = getContentSchema(ZkCertStandard.ZkKYC);
      expect(() => parseContentJson(kycFields, schema)).to.not.throw();
    });
    it('should reject invalid country and region', () => {
      const schema = getContentSchema(ZkCertStandard.ZkKYC);
      const invalidCountry = { ...kycFields, country: 'AAA' };
      expect(() => parseContentJson(invalidCountry, schema)).to.throw();
      const invalidRegion = { ...kycFields, region: 'US-ABC' };
      expect(() => parseContentJson(invalidRegion, schema)).to.throw();
    });
  });

  describe('Generic content', () => {
    it('should accept unknown content types', () => {
      type NameContent = { name: string };
      const cert: ZkCertData<NameContent> = {
        content: { name: 'Mark' },
        contentHash: '',
        did: '',
        expirationDate: 0,
        holderCommitment: '',
        leafHash: '',
        providerData: {
          ax: '',
          ay: '',
          s: '',
          r8x: '',
          r8y: '',
        },
        randomSalt: '',
        zkCertStandard: KnownZkCertStandard.ArbitraryData,
      };

      expect(cert.content.name).to.equal('Mark');
    });
  });
});
