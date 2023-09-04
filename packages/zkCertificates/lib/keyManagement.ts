/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import { Signer } from "ethers";
import createBlakeHash from "blake-hash";
import { Scalar, utils } from "ffjavascript";
import { Buffer } from 'buffer';
import { eddsaKeyGenerationMessage, eddsaPrimeFieldMod } from "@galactica-net/galactica-types";


/**
 * @description Generates the eddsa private key from the ethereum private key signing a fixed message
 * 
 * @param signer Ethers signer
 * @return The eddsa private key.
 */
export async function getEddsaKeyFromEthSigner(signer: Signer): Promise<string> {
  return signer.signMessage(eddsaKeyGenerationMessage);
}

/**
 * @description Generates an Elliptic-curve Diffie–Hellman shared key https://en.wikipedia.org/wiki/Elliptic-curve_Diffie%E2%80%93Hellman
 *   It is symmetric and can be produced by both parties using their private key and the other party's public key.
 *   Implementation based on https://github.com/privacy-scaling-explorations/maci/blob/796c3fa49d4983478d306061f094cf8a7532d63a/crypto/ts/index.ts#L328
 * 
 * @param privKey EdDSA private key of Alice
 * @param pubKey EdDSA public key of Bob
 * @param eddsa eddsa instance from circomlibjs
 * @return The ECDH shared key.
 */
export function generateEcdhSharedKey(privKey: string, pubKey: string[], eddsa: any): string[] {
  const keyBuffers = eddsa.babyJub.mulPointEscalar(pubKey, formatPrivKeyForBabyJub(privKey, eddsa));
  return keyBuffers.map((buffer: any) => eddsa.F.toObject(buffer).toString());
}

/**
 * @description Format a random private key to be compatible with the BabyJub curve.
 *  This is the format which should be passed into the PublicKey and other circuits.
 */
export function formatPrivKeyForBabyJub(privKey: string, eddsa: any) {
  const sBuff = eddsa.pruneBuffer(
    createBlakeHash("blake512").update(
      Buffer.from(privKey),
    ).digest().slice(0, 32)
  )
  const s = utils.leBuff2int(sBuff)
  return Scalar.shr(s, 3)
}

/**
 * @description Create the holder commitment for a zkCert
 * @dev holder commitment = poseidon(sign_eddsa(poseidon(pubkey)))
 *
 * @param eddsa EdDSA instance to use for signing (passed to avoid making this function async)
 * @param privateKey EdDSA Private key of the holder
 * @returns holder commitment
 */
export function createHolderCommitment(eddsa: any, privateKey: string): string {
  const poseidon = eddsa.poseidon;
  const pubKey = eddsa.prv2pub(privateKey);

  const hashPubkey: BigInt = poseidon.F.toObject(
    poseidon([pubKey[0], pubKey[1]])
  );
  // take modulo of hash to get it into the mod field supported by eddsa
  const hashPubkeyMsg = poseidon.F.e(
    Scalar.mod(hashPubkey, eddsaPrimeFieldMod)
  );
  const sig = eddsa.signPoseidon(privateKey, hashPubkeyMsg);

  // selfcheck
  if (!eddsa.verifyPoseidon(hashPubkeyMsg, sig, pubKey)) {
    throw new Error('Self check on EdDSA signature failed');
  }

  return poseidon.F
    .toObject(
      poseidon([
        sig.S.toString(),
        poseidon.F.toObject(sig.R8[0]).toString(),
        poseidon.F.toObject(sig.R8[1]).toString(),
      ])
    )
    .toString();
}
