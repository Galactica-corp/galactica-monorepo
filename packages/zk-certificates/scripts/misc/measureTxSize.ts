/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import hre from 'hardhat';

/**
 * Script for measuring the size of a transaction.
 *
 * It retrieves the transaction data from the blockchain, reconstructs the transaction object and measures the size of the transaction in bytes.
 */
async function main() {
  const txsToMeasure = [
    '0x88f24aa2fb8633b13b14e7d6311a385fbefa542ce4220c0d37af40edd3c88f44',
    '0x5c082522655da54dd01c1b85fdb1a3da202c8be2eeaf60e4d9e7f68b07ae70d7',
    '0x512128568c829e1d036b3602d4ca3bf7fac01f96c6a3851c8e1f5a0aff2e0b71',
    '0x955f7e0ba2f0fe5a677c8c0f8b65f56f6f208085bbb36fb47cbc1b8cdae1b0d7',
    '0x6414aada8b9d6e6fcf179fac49d75177277229f0164c0fb90ba3ebaa1e125fa0',
    '0x5fa2c13669047bb71b1b7d790d7094b296a346a997d593b82350e6e2312a5dbf',
  ];

  // Get the provider from hardhat
  const { provider } = hre.ethers;

  console.log('Measuring transaction sizes...\n');

  for (let i = 0; i < txsToMeasure.length; i++) {
    const txHash = txsToMeasure[i];
    try {
      console.log(`Transaction ${i + 1}: ${txHash}`);

      // Get the transaction data
      const tx = await provider.getTransaction(txHash);

      if (!tx) {
        console.log(`  ❌ Transaction not found\n`);
        continue;
      }

      // Calculate transaction size based on available data
      let txSize = 0;
      let calculatedSize = 0;

      // Basic transaction size calculation
      if (tx.type === 0) {
        // Legacy transaction
        // Legacy transaction fields: nonce, gasPrice, gasLimit, to, value, data, v, r, s
        calculatedSize = 9; // Base size for all fields

        // Add size for each field
        calculatedSize += Math.ceil(tx.nonce.toString(16).length / 2);
        calculatedSize += Math.ceil((tx.gasPrice || 0).toString(16).length / 2);
        calculatedSize += Math.ceil(tx.gasLimit.toString(16).length / 2);

        if (tx.to) {
          calculatedSize += 20; // Address is 20 bytes
        } else {
          calculatedSize += 1; // Empty address
        }

        calculatedSize += Math.ceil(tx.value.toString(16).length / 2);
        calculatedSize += Math.ceil(tx.data.length / 2);

        // Signature fields (approximate)
        calculatedSize += 32; // v, r, s (approximate)
      } else if (tx.type === 2) {
        // EIP-1559 transaction
        // EIP-1559 transaction fields: chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList, signatureYParity, signatureR, signatureS
        calculatedSize = 12; // Base size for all fields

        calculatedSize += Math.ceil(tx.chainId.toString(16).length / 2);
        calculatedSize += Math.ceil(tx.nonce.toString(16).length / 2);
        calculatedSize += Math.ceil(
          (tx.maxPriorityFeePerGas ?? 0).toString(16).length / 2,
        );
        calculatedSize += Math.ceil(
          (tx.maxFeePerGas ?? 0).toString(16).length / 2,
        );
        calculatedSize += Math.ceil(tx.gasLimit.toString(16).length / 2);

        if (tx.to) {
          calculatedSize += 20; // Address is 20 bytes
        } else {
          calculatedSize += 1; // Empty address
        }

        calculatedSize += Math.ceil(tx.value.toString(16).length / 2);
        calculatedSize += Math.ceil(tx.data.length / 2);

        // Access list size (simplified calculation)
        if (tx.accessList && tx.accessList.length > 0) {
          calculatedSize += tx.accessList.length * 22; // Rough estimate
        }

        // Signature fields (approximate)
        calculatedSize += 32; // signatureYParity, signatureR, signatureS (approximate)
      }

      // Estimate transaction size from data length and type
      txSize = calculatedSize; // Use calculated size as approximation

      console.log(`  📊 Transaction Size: ~${txSize} bytes`);
      console.log(`  📊 Calculated Size: ~${calculatedSize} bytes`);
      console.log(`  📦 Data Length: ${tx.data.length} bytes`);
      console.log('');
    } catch (error) {
      console.log(
        `  ❌ Error processing transaction: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  }

  console.log('Transaction size measurement completed!');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
