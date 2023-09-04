/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { ethers } from "hardhat";
import { fromDecToHex, fromHexToBytes32, processProof, processPublicSignals } from "../lib/helpers";


async function main() {
  // parameters
  const ageProofZkKYCAddr = '0xaA61e19ef7dE257D83521aDfE784572b6a914cEC';
  // you need to update the proofData because the currentTime public input is changing and with it the proof
  const proofData = {
    "proof": {
      "pi_a": [
        "8510777509776988357714844504969131415601469768050870191950790082326925033585",
        "15797758008786884923355907457762741407784256131259731768506711486717017873285",
        "1"
      ],
      "pi_b": [
        [
          "5024569997891664403296222100316250574687106437422621786623605390191792111943",
          "14995412707007872199337700381364083466310379251476404826956583455215628381791"
        ],
        [
          "7760036706822082359902540995453993425755956272543733027723157999846930817926",
          "6048938843416380222165756648780611410162007826719061963130495295983347295955"
        ],
        [
          "1",
          "0"
        ]
      ],
      "pi_c": [
        "2650597715858429281644375743104173119016219665804125177858186765524617849207",
        "12677031854435178738383549062585928674516187628288543331190773234441553848624",
        "1"
      ],
      "protocol": "groth16",
      "curve": "bn128"
    },
    "publicSignals": [
      "1",
      "11209916212079559410136633032138482335659351203987398533814440017698336323514",
      "1672537064",
      "478873986970679317615613077202381596613806366113",
      "2023",
      "1",
      "1",
      "18"
    ]
  }
  console.log("timestamp", (await ethers.provider.getBlock("latest")).timestamp);

  // wallets
  const [ user ] = await ethers.getSigners();
  console.log(`Using account ${user.address} as KYC provider`);
  console.log(`Account balance: ${(await user.getBalance()).toString()}`);
  console.log();


  // get contracts
  const ageProofZkKYC = await ethers.getContractAt('AgeProofZkKYC', ageProofZkKYCAddr);

  let [a, b, c] = processProof(proofData.proof);
  let publicInputs = processPublicSignals(proofData.publicSignals);
  console.log(`Formated proof: ${JSON.stringify({a:a, b:b, c:c}, null, 2)}`);
  console.log(`Formated publicInputs: ${JSON.stringify(publicInputs, null, 2)}`);
  console.log();

  console.log(`Sending proof for on-chain verification...`);
  let tx = await ageProofZkKYC.verifyProof(a, b, c, publicInputs);
  await tx.wait();

  console.log(`Done`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
