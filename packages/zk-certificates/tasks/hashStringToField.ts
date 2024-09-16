/* eslint-disable prefer-const */
/* Copyright (C) 2024 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import chalk from 'chalk';
import { buildPoseidon } from 'circomlibjs';
import { task } from 'hardhat/config';
import { string } from 'hardhat/internal/core/params/argumentTypes';

import { hashMessage } from '../lib/poseidon';

/**
 * Script for hashing a string into a field element.
 * @param args - See task definition below or 'yarn hardhat hashStringToField --help'.
 */
async function main(args: any) {
  console.log(`Poseidon (Sponge) Hash of '${args.value}':`);

  const poseidon = await buildPoseidon();
  const hash = poseidon.F.toObject(hashMessage(poseidon, args.value));

  console.log(chalk.green(`${hash}`));
}

task('hashStringToField', 'Util to hash a string value to a field element')
  .addPositionalParam('value', 'The string to hash', undefined, string, false)
  .setAction(async (taskArgs, _) => {
    await main(taskArgs).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  });
