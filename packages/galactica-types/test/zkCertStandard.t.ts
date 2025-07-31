import { expect } from 'chai';
import {
  ZkCertStandard,
  getContentFields,
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
});
