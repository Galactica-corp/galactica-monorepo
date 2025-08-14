import type {
  EncryptedZkCert,
  ZkCertRegistered,
} from '@galactica-net/galactica-types';
import { ENCRYPTION_VERSION } from '@galactica-net/galactica-types';
import { encryptSafely } from '@metamask/eth-sig-util';

/**
 * Encrypt a zkCert for exporting.
 * @param zkCert - The ZkCertRegistered to encrypt.
 * @param pubKey - The public key for encryption.
 * @param holderCommitment - The holder commitment to associate the zkCert with the holder who can decrypt it.
 * @returns The encrypted ZkCertRegistered as EthEncryptedData.
 */
export function encryptZkCert(
  zkCert: ZkCertRegistered,
  pubKey: string,
  holderCommitment: string,
): EncryptedZkCert {
  return {
    ...encryptSafely({
      publicKey: pubKey,
      data: zkCert,
      version: ENCRYPTION_VERSION,
    }),
    holderCommitment,
  };
}
