import type { StorageState } from '../types';

export const findCert = (
  state: StorageState,
  cert: {
    leafHash: string;
    registration: { address: string };
    zkCertStandard: string;
  },
) => {
  return state.zkCerts.find(
    (candidate) =>
      candidate.zkCert.leafHash === cert.leafHash &&
      candidate.zkCert.registration.address === cert.registration.address &&
      candidate.zkCert.zkCertStandard === cert.zkCertStandard,
  );
};
