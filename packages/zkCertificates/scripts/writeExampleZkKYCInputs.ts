/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import fs from 'fs';
import { generateSampleZkKYC, generateZkKYCProofInput } from './generateZKKYCInput';

/**
 * @description Script for creating proof input for a zkKYC certificate
 */
async function main() {
  const zkKYC = await generateSampleZkKYC();
  const zkKYCInput = await generateZkKYCProofInput(zkKYC, 0, "0x0");

  fs.writeFileSync(
    './circuits/input/zkKYC.json',
    JSON.stringify(zkKYCInput, null, 2),
    'utf8'
  );

  // also create example for ageProofZkKYC
  const ageProofZkKYCInput = {
    ...zkKYCInput,
    currentYear: 2023,
    currentMonth: 5,
    currentDay: 9,
    ageThreshold: 18,
  };

  fs.writeFileSync(
    './circuits/input/ageProofZkKYC.json',
    JSON.stringify(ageProofZkKYCInput, null, 2),
    'utf8'
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
