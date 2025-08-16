/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import type { ZkCertRegistered } from '@galactica-net/galactica-types';
import {
  getContentSchema,
  KnownZkCertStandard,
  parseContentJson,
  ENCRYPTION_VERSION,
} from '@galactica-net/galactica-types';
import { encryptSafely, getEncryptionPublicKey } from '@metamask/eth-sig-util';
import { expect } from 'chai';
import type { Eddsa } from 'circomlibjs';
import { buildEddsa } from 'circomlibjs';

import zkCert from '../../../../test/zkCert.json';
import dataExample from '../../example/arbitraryDataFields.json';
import kycExample from '../../example/kycFields.json';
import reyExample from '../../example/reyFields.json';
import twitterExample from '../../example/twitterFields.json';
import {
  prepareContentForCircuit,
  dateStringToUnixTimestamp,
  padZkCertForEncryption,
} from '../../lib/zkCertificateDataProcessing';

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

  describe('Encryption padding workaround', () => {
    /**
     * This is a zkCert that is affected by the padding issue.
     * @returns A zkCert that is affected by the padding issue.
     */
    function getAffectedData(): ZkCertRegistered {
      return JSON.parse(
        '{"holderCommitment": "7735727246471767370788268218008649659345393646775019247808120566463753454903", "leafHash": "6981810429802296585701394890552897013958081400319643330577058257399344841317", "did": "did:gip1:6981810429802296585701394890552897013958081400319643330577058257399344841317", "zkCertStandard": "gip1", "content": { "surname": "Doe", "forename": "John", "yearOfBirth": 1989, "monthOfBirth": 5, "dayOfBirth": 28, "verificationLevel": 1, "streetAndNumber": "Bergstrasse 2", "postcode": "9490", "town": "Vaduz", "country": "LIE", "citizenship": "SWE" }, "contentHash": "13498937448046187479975980844060005602014574276619662435996314654414855730267", "providerData": { "ax": "15406969288470165023871038883559428361347771769942780978458824541644678347676", "ay": "20991550033662087418703288468635020238179240540666871457074661834730112436793", "s": "2069640368802769434516651458842041348966598726659899127921244354393776377193", "r8x": "12810971025230743672526891719808314265594509836316133835794402516688634444718", "r8y": "9227397495571760946162780587628870107339943767949871702835560214994698544074" }, "randomSalt": "15921737953522648497130687044332513222384600639298570040447022555454073920296", "expirationDate": 2344658820, "merkleProof": { "leaf": "6981810429802296585701394890552897013958081400319643330577058257399344841317", "root": "18948913302284886253175013049763825106533402619649822561043952907678549624518", "leafIndex": 1, "pathElements": ["10825103365240568452034812899914838639078535708786160451885630538843257070073", "17711743441471139019568003472095018612192714617594252242304492941901256166392", "14160256668110176237652855315388266406606785144653806925293311761178671846740", "17619695615639375563172755451063681091123583187367666354590446695851847455206", "13318301576191812234266801152872599855532005448246358193934877587650370582600", "14788131755920683191475597296843560484793002846324723605628318076973413387512", "15889843854411046052299062847446330225099449301489575711833732034292400193334", "4591007468089219776529077618683677913362369124318235794006853887662826724179", "974323504448759598753817959892943900419910101515018723175898332400800338902", "10904304838309847003348248867595510063038089908778911273415397184640076197695", "6882370933298714404012187108159138675240847601805332407879606734117764964844", "5139203521709906739945343849817745409005203282448907255220261470507345543242", "13660695785273441286119313134036776607743178109514008645018277634263858765331", "10348593108579908024969691262542999418313940238885641489955258549772405516797", "8081407491543416388951354446505389320018136283676956639992756527902136320118", "9958479516685283258442625520693909575742244739421083147206991947039775937697", "7970914938810054068245748769054430181949287449180056729094980613243958329268", "9181633618293215208937072826349181607144232385752050143517655282584371194792", "4290316886726748791387171617200449726541205208559598579274245616939964852707", "6485208140905921389448627555662227594654261284121222408680793672083214472411", "9758704411889015808755428886859795217744955029900206776077230470192243862856", "2597152473563104183458372080692537737210460471555518794564105235328153976766", "3463902188850558154963157993736984386286482462591640080583231993828223756729", "4803991292849258082632334882589144741536815660863591403881043248209683263881", "8436762241999885378816022437653918688617421907409515804233361706830437806851", "1050020814711080606631372470935794540279414038427561141553730851484495104713", "12563171857359400454610578260497195051079576349004486989747715063846486865999", "15261846589675849940851399933657833195422666255877532937593219476893366898506", "3948769100977277285624942212173034288901374055746067204399375431934078652233", "5165855438174057791629208268983865460579098662614463291265268210129645045606", "19766134122896885292208434174127396131016457922757580293859872286777805319620", "21875366546070094216708763840902654314815506651483888537622737430893403929600"] }, "registration": { "address": "0xa922eE97D068fd95d5692c357698F6Bf2C6fd8cE", "chainID": 843843, "revocable": true, "leafIndex": 1}}',
      );
    }
    const testEntropyEncrypt =
      '0x06f095a41e4192bde91ed47f9b03286f2282f5416967aaa5d9b02fb85c5b1c1a';
    const encryptionPubKey = getEncryptionPublicKey(
      testEntropyEncrypt.slice(2),
    );

    it('should need a workaround (if this fails, it has been fixed upstream and we can remove the workaround)', () => {
      const data = getAffectedData();
      expect(() =>
        encryptSafely({
          publicKey: encryptionPubKey,
          data,
          version: ENCRYPTION_VERSION,
        }),
      ).to.throw();
    });

    it('should be fixed with workaround', () => {
      const data = padZkCertForEncryption(getAffectedData());
      expect(() =>
        encryptSafely({
          publicKey: encryptionPubKey,
          data,
          version: ENCRYPTION_VERSION,
        }),
      ).to.not.throw();
    });

    it('should not change anything if not needed', () => {
      const data = zkCert as ZkCertRegistered;
      const padded = padZkCertForEncryption(data);
      expect(padded).to.deep.equal(data);
    });
  });
});
