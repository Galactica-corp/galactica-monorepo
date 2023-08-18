export type SdkConfig = {
  contracts: {
    kycGuardianWhitelist: string;
    zkKycRegistry: string;
    verificationSbt: string;
    exampleZkKycAgeProof: string;
    exampleZkpVerifier: string;
    exampleDapp: string;
    exampleInstitution: string[];
    basicKycExampleDapp: string;
    repeatableZkKycTest: string;
  };
};

export const sdkConfig: SdkConfig = {
  contracts: {
    kycGuardianWhitelist: "0x4De49e2047eE726B833fa815bf7392958245832d",
    zkKycRegistry: "0x8eD8311ED65eBe2b11ED8cB7076E779c1030F9cF",
    verificationSbt: "0xc1a96F7DD532fa4B774C41f9Eb853893314cB036",
    exampleZkKycAgeProof: "0x7790dDa9E7569bc3580E675D75Ad115E7B35c6ff",
    exampleZkpVerifier: "0xf1947AeD2d0a5Ff90D54b63C85904d258D3B5E63",
    exampleDapp: "0xf28CFA74C8f1298aaE8231dD10D3594dFB0D6201",
    exampleInstitution: [
      "0x9b48274258501C54E9ac7B165B391bf2b6E863EE",
      "0x8d2a748ebC5EbD2F96BAb1De576CA70dbdFa336B",
      "0x9d862c70a0e8726cce50308FE0194652Fb078739",
    ],
    basicKycExampleDapp: "0x02ee87FE35cF9e635B752671D5477516256aDB4f",
    repeatableZkKycTest: "0x57ebf246fC38c59f48CE316381eEFF883C006Fa1",
  },
};
