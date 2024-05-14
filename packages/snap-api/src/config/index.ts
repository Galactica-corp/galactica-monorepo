export type ChainId = '9302' | '41238';

export type SdkConfig = {
  contracts: Record<
    ChainId,
    {
      kycGuardianWhitelist: string;
      zkKycRegistry: string;
      verificationSbt: string;
      exampleZkKycAgeProof: string;
      exampleZkpVerifier: string;
      exampleDapp: string;
      exampleInstitution: string[];
      exampleZkKyc: string;
      repeatableZkpTest: string;
      devnetGuardian: string;
    }
  >;
  defaultSnapOrigin: string;
  defaultSnapVersion: string;
};

export const sdkConfig = {
  defaultSnapOrigin: 'npm:@galactica-net/snap',
  defaultSnapVersion: '0.7.0',
  contracts: {
    41238: {
      kycGuardianWhitelist: '0xB95314E42d8Da05b1D805039F7b96e3935584543',
      zkKycRegistry: '0x0415E990e55071F0d448F87CD170528C7783A484',
      verificationSbt: '0x062DaB74A2709EC730FE11b3d9C00033B0FBAf92',
      exampleZkKycAgeProof: '0x1554B2D7422941Be9903040d9946da60d9f2bC3C',
      exampleZkpVerifier: '0xA437DFE87F9096e52E4dEcAA7cfc14d82A5aE07e',
      exampleDapp: '0xBD2FAA4835E1A462Ea4FDA39352F24C58e237e2a',
      exampleInstitution: [
        '0x5E523B1c7c04eB971D3b851C82d3935b91fb4b3e',
        '0xcc433436B6c01142EC9B95a1b80B3734CD4849f3',
        '0x8d5ebACB647aea8a76082A36C93997765A50AF0E',
      ],
      exampleZkKyc: '0xD95efF72F06079DEcE33b18B165fc3A7a4bdc1fD',
      repeatableZkpTest: '0xa99fcD678D985fB2ac8aD3fE913aED88705A44fc',
      devnetGuardian: '0x71d80ea7744302E5b1cFD61a7a26153FF221ca9E',
    },
    9302: {
      kycGuardianWhitelist: '0x8Db9C6d860694d6bF151c961E2A55d3F51e2D138',
      zkKycRegistry: '0x85032c035494324f62A5AfE2507d5427dFd72e76',
      verificationSbt: '0xc6d55A0F0f7b6b5a2418963AC35d312535F20D67',
      exampleZkKycAgeProof: '0x1fA98f7B53dCCC93f37243e2069781225dE442f3',
      exampleZkpVerifier: '0xCF0EA7C6b77c2ef8EbCD8854671f35f092Db7A5E',
      exampleDapp: '0x9a17084bb850FBF1431BBEC6e7b316F374E2b49c',
      exampleInstitution: [
        '0xb8B1720908717E585d98A502c0A9743c06DC96E5',
        '0xB9e011AD8849aeA1F2d9d30582987645bFAE3729',
        '0xC29A1e7aD2f3B938a1668d4e2702801BF21CE32C',
      ],
      exampleZkKyc: '0x6989febF9623FAD3c5FC25B84e0b8F2F0d9a68f0',
      repeatableZkpTest: '0x4262b70fDBBF05C48a0887472b89988B84C98564',
      devnetGuardian: '0xEcE0BBeB552710718A1bD5E028443ff9B2f26BE5',
    },
  },
};
