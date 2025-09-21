import type { ButtonClickEvent } from '@metamask/snaps-sdk';

import { Cert } from '../components/cert';
import { getState, getZkCert } from '../stateManagement';

type Params = {
  event: ButtonClickEvent;
};

export const cancelDeleteCertHandler = async (params: Params) => {
  const { event } = params;
  if (!event.name) {
    throw new Error('cancelDeleteCertHandler. Event name is undefined');
  }

  const leafHash = event.name.replace('cancel-delete-cert-id-', '');
  const state = await getState(snap);

  const foundCert = state.zkCerts.find((cert) => {
    return cert.zkCert.leafHash === leafHash;
  })?.zkCert;

  if (!foundCert) {
    throw new Error('cancelDeleteCertHandler. Cert is not found');
  }

  const zkCertObject = getZkCert(
    foundCert.leafHash,
    state.zkCerts.map((cert) => cert.zkCert),
  );

  return <Cert cert={zkCertObject} />;
};
