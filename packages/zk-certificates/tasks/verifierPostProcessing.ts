/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import fs from 'fs';

/**
 * Post-processes Solidity verifier code to match project conventions.
 *
 * @param verifierPath - Path to the Solidity verifier file.
 * @param verifierName - Name of the verifier contract (in PascalCase).
 */
export function postProcessSolidityVerifier(
  verifierPath: string,
  verifierName: string,
): void {
  const contentBefore = fs.readFileSync(verifierPath, 'utf8');
  const contentAfter = contentBefore
    // Make contract names unique so that hardhat does not complain
    .replace(
      /contract Groth16Verifier \{/gu,
      `contract ${verifierName}Verifier {`,
    )
    // Allow dynamic length array as _pubSignals (including spaces to only replace the instance in the verifier function)
    .replace(
      / uint\[[0-9]*\] calldata _pubSignals/gu,
      ` uint[] calldata _pubSignals`,
    )
    // Adjust the now variable length array _pubSignals correctly
    .replace(
      /calldataload\(add\(_pubSignals/gu,
      `calldataload(add(_pubSignals.offset`,
    )
    .replace(
      / checkPairing\(_pA, _pB, _pC, _pubSignals/gu,
      ` checkPairing(_pA, _pB, _pC, _pubSignals.offset`,
    );

  fs.writeFileSync(verifierPath, contentAfter, 'utf8');
}
