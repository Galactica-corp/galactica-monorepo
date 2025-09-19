/*
 * Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import {
  getContentSchema,
  KnownZkCertStandard,
  parseContentJson,
} from '@galactica-net/galactica-types';
import { expect } from 'chai';
import type { Eddsa } from 'circomlibjs';
import { buildEddsa } from 'circomlibjs';

import dataExample from '../../example/arbitraryDataFields.json';
import kycExample from '../../example/kycFields.json';
import reyExample from '../../example/reyFields.json';
import twitterExample from '../../example/twitterFields.json';
import { dateStringToUnixTimestamp, prepareContentForCircuit } from '../../lib';

describe('ZK Certificate Data Processing', () => {
  let eddsa: Eddsa;

  before(async () => {
    eddsa = await buildEddsa();
  });

  describe('Examples', () => {
    it('should process kyc example', async () => {
      const processed = prepareContentForCircuit(
        eddsa,
        parseContentJson(
          kycExample,
          getContentSchema(KnownZkCertStandard.ZkKYC),
        ),
        getContentSchema(KnownZkCertStandard.ZkKYC),
      );

      // check that all string fields have been hashed by checking that all remaining strings are numbers
      for (const field of Object.keys(processed)) {
        if (typeof processed[field] === 'string') {
          expect(processed[field]).to.match(/^[0-9]+$/u);
        }
      }
    });

    it('should process twitter example', async () => {
      const processed = prepareContentForCircuit(
        eddsa,
        parseContentJson(
          twitterExample,
          getContentSchema(KnownZkCertStandard.Twitter),
        ),
        getContentSchema(KnownZkCertStandard.Twitter),
      );

      expect(processed.username).to.match(/^[0-9]+$/u);
      expect(processed.createdAt).to.match(/^[0-9]+$/u);
    });

    it('should process rey example', async () => {
      const processed = prepareContentForCircuit(
        eddsa,
        parseContentJson(reyExample, getContentSchema(KnownZkCertStandard.Rey)),
        getContentSchema(KnownZkCertStandard.Rey),
      );

      expect(processed.xUsername).to.match(/^[0-9]+$/u);
    });

    it('should process arbitrary data example', async () => {
      const processed = prepareContentForCircuit(
        eddsa,
        parseContentJson(
          dataExample,
          getContentSchema(KnownZkCertStandard.ArbitraryData),
        ),
        getContentSchema(KnownZkCertStandard.ArbitraryData),
      );

      expect(processed.type).to.match(/^[0-9]+$/u);
      expect(processed.example).to.match(/^[0-9]+$/u);
    });

    it('should handle gip2 case without properties field in schema', async () => {
      const gip2Schema = {
        type: 'object',
        // No properties field - this is the gip2 case
      };

      const gip2Content: Record<string, unknown> = {
        field1: 'value1',
        field2: undefined, // This should throw a proper error about missing required field
      };

      // Should throw a proper error message about undefined field without default
      // instead of the current TypeError about accessing properties of undefined
      expect(() => {
        prepareContentForCircuit(eddsa, gip2Content, gip2Schema);
      }).to.throw(
        'Certificate field field2 is undefined and no default value is provided in the schema.',
      );
    });

    it('should handle gip2 case with valid content fields', async () => {
      const gip2Schema = {
        type: 'object',
        // No properties field - this is the gip2 case
      };

      const gip2Content: Record<string, unknown> = {
        // All fields provided - should work
        field1: 'value1',
        field2: 'value2',
      };

      const processed = prepareContentForCircuit(
        eddsa,
        gip2Content,
        gip2Schema,
      );

      expect(processed.field1).to.match(/^[0-9]+$/u);
      expect(processed.field2).to.match(/^[0-9]+$/u);
    });
  });

  describe('Date Processing', () => {
    it('should process RCF339', async () => {
      const res = dateStringToUnixTimestamp('2024-09-10T09:15:44+00:00');
      expect(res).to.equal(1725959744);
    });

    it('should process unix string', async () => {
      const res = dateStringToUnixTimestamp('1725959769');
      expect(res).to.equal(1725959769);
    });
  });
});
