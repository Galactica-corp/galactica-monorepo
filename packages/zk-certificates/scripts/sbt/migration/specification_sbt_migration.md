# Specification: SBT migration

## Overview
We are transitioning from our Testnet to Mainnet. Soul-bound tokens that were rewarded to users on testnet should be migrated to mainnet so that users can hold and utilize them there.

## Requirements
1. Smart contracts for the SBTs from testnet should be deployed on mainnet.
2. The token name, symbol and metadata fields should be the same.
3. Every account holding an SBT on testnet should hold the same one on mainnet.
4. The input table lists SBTs to migrate is given as a .csv file. We should update the file with the mainnet addresses of migrated contracts. 

## Implementation details
- The smart contracts on testnet are either the `ClaimrSBT.sol` or `GalacticaOfficialSBT.sol`.
- The input table has a column `issuance will continue after mainnet?`. If it is set to `no`, we can deploy the `GalacticaOfficialSBT.sol` on mainnet for it and use its batch_mint function.
- Contracts with `issuance will continue after mainnet?` set to `yes`, we can skip for now. We first have to figure out how to deploy and continue to operate them.
- As the migration is processing, the input table should be appended with gathered data to log the progress and state.
- First we want to build a prototype that transfers the first SBT in the input table. After testing it thoroughly and manually, we can continue and iterate through the whole table.

## Data gathering steps
1. Query testnet data including: name, symbol, metadata and append it to the input table 
2. Check if the contract is a `GalacticaOfficialSBT` or a `ClaimrSBT` by testing if it has a `ISSUER_ROLE` field. Note the result in the input table.
3. Collect holder data. Iterate through the logs of the SBT to find all issuance events. They are part of ERC721 and have the signature `Transfer(address indexed from, address indexed to, uint256 indexed tokenId)` with the `from` field set to the ZeroAddress. Save the list of holders in the input table.

## Transfer steps (skip if `issuance will continue after mainnet?` set to `yes`)
4. Read input and gathered data from the table.
5. Deploy the `GalacticaOfficialSBT` contract on mainnet. Set the issuer and owner fields in the constructor to the address of the deployer. Record the deployed address to the table.
6. Use the `batchMint` function to mint SBTs for all holders we collected on mainnet.
7. Add a `done` flag in the table.


