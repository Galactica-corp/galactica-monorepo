/* Copyright (C) 2023 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. */
import {
  eddsaKeyGenerationMessage,
  eddsaPrimeFieldMod,
  EddsaPrivateKey,
} from '@galactica-net/galactica-types';
import createBlakeHash from 'blake-hash';
import { Buffer } from 'buffer';
import { Eddsa } from 'circomlibjs';
import { Signer } from 'ethers';
import { Scalar, utils } from 'ffjavascript';

/**
 * Generates the eddsa private key from the ethereum private key signing a fixed message.
 *
 * @param signer - Ethers signer.
 * @returns The eddsa private key as buffer.
 */
export async function getEddsaKeyFromEthSigner(
  signer: Signer,
): Promise<EddsaPrivateKey> {
  // use signature as entropy input so that the EdDSA key can be derived from the Ethereum private key
  const signature = await signer.signMessage(eddsaKeyGenerationMessage);
  return getEddsaKeyFromEntropy(signature.slice(2));
}

/**
 * Generates the EdDSA private key, following https://www.rfc-editor.org/rfc/rfc8032#section-5.1.5 .
 *
 * @param entropy - Random entropy to generate key from as hex string.
 * @returns The eddsa private key as buffer.
 */
export function getEddsaKeyFromEntropy(entropy: string): EddsaPrivateKey {
  let source = entropy;
  if (entropy.startsWith('0x')) {
    source = entropy.slice(2);
  }
  if (source.length < 64) {
    throw new Error('Entropy must be at least 32 bytes long');
  }
  if (!isHex(source)) {
    throw new Error('Entropy must be a hex string');
  }

  // According to https://www.rfc-editor.org/rfc/rfc8032#section-5.1.5 :
  // The private key is 32 octets (256 bits) of cryptographically secure random data.
  // So we can just take the first 32 bytes of the entropy.
  const privKey = Buffer.from(entropy, 'hex').subarray(0, 32);
  return privKey;
}

/**
 * Generates an Elliptic-curve Diffie–Hellman shared key https://en.wikipedia.org/wiki/Elliptic-curve_Diffie%E2%80%93Hellman.
 * It is symmetric and can be produced by both parties using their private key and the other party's public key.
 * Implementation based on https://github.com/privacy-scaling-explorations/maci/blob/796c3fa49d4983478d306061f094cf8a7532d63a/crypto/ts/index.ts#L328.
 *
 * @param privKey - EdDSA private key of Alice.
 * @param pubKey - EdDSA public key of Bob.
 * @param eddsa - EdDSA instance from circomlibjs.
 * @returns The ECDH shared key..
 */
export function generateEcdhSharedKey(
  privKey: EddsaPrivateKey,
  pubKey: [Uint8Array, Uint8Array],
  eddsa: Eddsa,
): string[] {
  const keyBuffers = eddsa.babyJub.mulPointEscalar(
    pubKey,
    formatPrivKeyForBabyJub(privKey, eddsa),
  );
  return keyBuffers.map((buffer: any) => eddsa.F.toObject(buffer).toString());
}

/**
 * Format a random private key to be compatible with the BabyJub curve.
 * This is the format which should be passed into the PublicKey and other circuits.
 *
 * @param privKey - Private key to format.
 * @param eddsa - EdDSA instance from circomlibjs.
 * @returns The formatted private key.
 */
export function formatPrivKeyForBabyJub(
  privKey: EddsaPrivateKey,
  eddsa: Eddsa,
) {
  const sBuff = eddsa.pruneBuffer(
    createBlakeHash('blake512').update(privKey).digest().slice(0, 32),
  );
  const scalar = utils.leBuff2int(sBuff);
  return Scalar.shr(scalar, 3);
}

/**
 * Create the holder commitment for a zkCert.
 * Holder commitment = poseidon(sign_eddsa(poseidon(pubkey))).
 *
 * @param eddsa - EdDSA instance to use for signing (passed to avoid making this function async).
 * @param privateKey - EdDSA Private key of the holder.
 * @returns Holder commitment.
 */
export function createHolderCommitment(
  eddsa: Eddsa,
  privateKey: Buffer,
): string {
  const { poseidon } = eddsa;
  const pubKey = eddsa.prv2pub(privateKey);

  const hashPubkey: bigint = poseidon.F.toObject(
    poseidon([pubKey[0], pubKey[1]]),
  );
  // take modulo of hash to get it into the mod field supported by eddsa
  const hashPubkeyMsg = poseidon.F.e(
    Scalar.mod(hashPubkey, eddsaPrimeFieldMod),
  );
  const signature = eddsa.signPoseidon(privateKey, hashPubkeyMsg);

  // self-check
  if (!eddsa.verifyPoseidon(hashPubkeyMsg, signature, pubKey)) {
    throw new Error('Self check on EdDSA signature failed');
  }

  return poseidon.F.toObject(
    poseidon([
      signature.S.toString(),
      poseidon.F.toObject(signature.R8[0]).toString(),
      poseidon.F.toObject(signature.R8[1]).toString(),
    ]),
  ).toString();
}

/**
 * Check if a string is a hex string.
 *
 * @param test - String to check.
 * @returns True if the string is a hex string.
 */
function isHex(test: string) {
  const regexp = /^[0-9a-fA-F]+$/u;
  return regexp.test(test);
}
