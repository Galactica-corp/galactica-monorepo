import type { ButtonClickEvent } from '@metamask/snaps-sdk';

import { Cert } from '../components/cert';
import { getState } from '../stateManagement';

type Params = {
  event: ButtonClickEvent;
};
export const viewCertHandler = async (params: Params) => {
  const { event } = params;
  if (!event.name) {
    throw new Error('Event name is undefined');
  }

  const state = await getState(snap);

  const leafHash = event.name.replace('view-cert-id-', '');
  const foundCert = state.zkCerts.find((cert) => {
    return cert.zkCert.leafHash === leafHash;
  })?.zkCert;

  if (!foundCert) {
    throw new Error('viewCertHandler. Cert is not found');
  }

  return <Cert cert={foundCert} />;
};
