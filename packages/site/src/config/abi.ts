export const ageProofZkKYC = {
  address: '0x9a17084bb850FBF1431BBEC6e7b316F374E2b49c',
  abi: [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_owner",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_verifier",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_KYCRegistry",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_galacticaInstitution",
          "type": "address"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "previousOwner",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "newOwner",
          "type": "address"
        }
      ],
      "name": "OwnershipTransferred",
      "type": "event"
    },
    {
      "inputs": [],
      "name": "KYCRegistry",
      "outputs": [
        {
          "internalType": "contract IKYCRegistry",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "galacticaInstitution",
      "outputs": [
        {
          "internalType": "contract IGalacticaInstitution",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "newOwner",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "owner",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "renounceOwnership",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "contract IGalacticaInstitution",
          "name": "newGalacticaInstitution",
          "type": "address"
        }
      ],
      "name": "setGalacticaInstituion",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "contract IKYCRegistry",
          "name": "newKYCRegistry",
          "type": "address"
        }
      ],
      "name": "setKYCRegistry",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_newOwner",
          "type": "address"
        }
      ],
      "name": "setNewOwner",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "contract IAgeProofZkKYCVerifier",
          "name": "newVerifier",
          "type": "address"
        }
      ],
      "name": "setVerifier",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "timeDifferenceTolerance",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "transferOwnership",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "verifier",
      "outputs": [
        {
          "internalType": "contract IAgeProofZkKYCVerifier",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256[2]",
          "name": "a",
          "type": "uint256[2]"
        },
        {
          "internalType": "uint256[2][2]",
          "name": "b",
          "type": "uint256[2][2]"
        },
        {
          "internalType": "uint256[2]",
          "name": "c",
          "type": "uint256[2]"
        },
        {
          "internalType": "uint256[16]",
          "name": "input",
          "type": "uint256[16]"
        }
      ],
      "name": "verifyProof",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
  ],
};

export const mockDApp = {
  address: '0x80c8C09868E97CF789e10666Ad10dD96639aCB6e',
  abi: [
    {
      "inputs": [
        {
          "internalType": "contract VerificationSBT",
          "name": "_SBT",
          "type": "address"
        },
        {
          "internalType": "contract IVerifierWrapper",
          "name": "_verifierWrapper",
          "type": "address"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [],
      "name": "SBT",
      "outputs": [
        {
          "internalType": "contract VerificationSBT",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "tokenIndex",
          "type": "uint256"
        },
        {
          "internalType": "uint256[2]",
          "name": "a",
          "type": "uint256[2]"
        },
        {
          "internalType": "uint256[2][2]",
          "name": "b",
          "type": "uint256[2][2]"
        },
        {
          "internalType": "uint256[2]",
          "name": "c",
          "type": "uint256[2]"
        },
        {
          "internalType": "uint256[16]",
          "name": "input",
          "type": "uint256[16]"
        }
      ],
      "name": "airdropToken",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "name": "hasReceivedToken1",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "name": "hasReceivedToken2",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "contract ERC20",
          "name": "_token1",
          "type": "address"
        }
      ],
      "name": "setToken1",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "contract ERC20",
          "name": "_token2",
          "type": "address"
        }
      ],
      "name": "setToken2",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "token1",
      "outputs": [
        {
          "internalType": "contract ERC20",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "token1AirdropAmount",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "token2",
      "outputs": [
        {
          "internalType": "contract ERC20",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "token2AirdropAmount",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "verifierWrapper",
      "outputs": [
        {
          "internalType": "contract IVerifierWrapper",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ],
};

export const verificationSBT = {
  address: '0x9a17084bb850FBF1431BBEC6e7b316F374E2b49c',
  abi: [
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "dApp",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "humanID",
          "type": "bytes32"
        }
      ],
      "name": "VerificationSBTMinted",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "name": "VerificationSBTMapping",
      "outputs": [
        {
          "internalType": "address",
          "name": "dApp",
          "type": "address"
        },
        {
          "internalType": "contract IVerifierWrapper",
          "name": "verifierWrapper",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "expirationTime",
          "type": "uint256"
        },
        {
          "internalType": "bytes32",
          "name": "verifierCodehash",
          "type": "bytes32"
        },
        {
          "internalType": "bytes32",
          "name": "humanID",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "dApp",
          "type": "address"
        }
      ],
      "name": "getHumanID",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "dApp",
          "type": "address"
        }
      ],
      "name": "getVerificationSBTInfo",
      "outputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "dApp",
              "type": "address"
            },
            {
              "internalType": "contract IVerifierWrapper",
              "name": "verifierWrapper",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "expirationTime",
              "type": "uint256"
            },
            {
              "internalType": "bytes32",
              "name": "verifierCodehash",
              "type": "bytes32"
            },
            {
              "internalType": "bytes32[2]",
              "name": "encryptedData",
              "type": "bytes32[2]"
            },
            {
              "internalType": "uint256[2]",
              "name": "userPubKey",
              "type": "uint256[2]"
            },
            {
              "internalType": "bytes32",
              "name": "humanID",
              "type": "bytes32"
            }
          ],
          "internalType": "struct VerificationSBT.VerificationSBTInfo",
          "name": "",
          "type": "tuple"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "dApp",
          "type": "address"
        }
      ],
      "name": "isVerificationSBTValid",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "internalType": "contract IVerifierWrapper",
          "name": "_verifierWrapper",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "_expirationTime",
          "type": "uint256"
        },
        {
          "internalType": "bytes32[2]",
          "name": "_encryptedData",
          "type": "bytes32[2]"
        },
        {
          "internalType": "uint256[2]",
          "name": "_userPubKey",
          "type": "uint256[2]"
        },
        {
          "internalType": "bytes32",
          "name": "_humanID",
          "type": "bytes32"
        }
      ],
      "name": "mintVerificationSBT",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ],
};
