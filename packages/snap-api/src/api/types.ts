import type { ZkCertStandard } from '@galactica-net/galactica-types';

export type {
  ProviderData,
  MerkleProof,
  ZkCertData,
  ZkCertRegistered,
  EncryptedZkCert,
} from '@galactica-net/galactica-types';
export type {
  ZkCertStandard,
  ProverData,
  ProverLink,
  ZkProof,
} from '@galactica-net/galactica-types';
export { KnownZkCertStandard } from '@galactica-net/galactica-types';

/**
 * Parameters for zkCert selection.
 * Because the website does not know IDs for zkCerts, it can provide an optional list of filters to simplify selecting the zkCert.
 */
export type ZkCertSelectionParams = {
  zkCertStandard?: ZkCertStandard;
  registryAddress?: string;
  chainID?: number;
  expirationDate?: number;
  providerAx?: string;
};
