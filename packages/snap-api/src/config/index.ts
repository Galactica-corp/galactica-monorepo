export type SdkConfig = {
  contracts: {
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
  };
  defaultSnapOrigin: string;
  defaultSnapVersion: string;
};

export const sdkConfig: SdkConfig = {
  contracts: {
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
  defaultSnapOrigin: 'npm:@galactica-net/snap',
  defaultSnapVersion: '0.7.0',
};
