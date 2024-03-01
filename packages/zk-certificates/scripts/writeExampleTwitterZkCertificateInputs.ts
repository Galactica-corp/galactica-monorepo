/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import fs from 'fs';

import {
  generateSampleTwitterZkCertificate,
  generateTwitterZkCertificateProofInput,
} from './generateTwitterZkCertificateInput';

/**
 * Script for creating proof input for a zkKYC certificate.
 */
async function main() {
  const twitterZkCertificate = await generateSampleTwitterZkCertificate();
  const twitterZkCertificateInput = await generateTwitterZkCertificateProofInput(twitterZkCertificate);

  fs.writeFileSync(
    './circuits/input/twitterZkCertificate.json',
    JSON.stringify(twitterZkCertificateInput, null, 2),
    'utf8',
  );

  // also create example for twitterZkCertificate followersCount
  const twitterFollowersCountProofInput = {
    ...twitterZkCertificateInput,
    followersCountThreshold: 10,
  };

  fs.writeFileSync(
    './circuits/input/twiiterFollowersCountProof.json',
    JSON.stringify(twitterFollowersCountProofInput, null, 2),
    'utf8',
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
