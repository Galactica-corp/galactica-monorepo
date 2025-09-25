import type { ButtonClickEvent } from '@metamask/snaps-sdk';

import { Cert } from '../components/cert';
import { getState } from '../stateManagement';

type Params = {
  event: ButtonClickEvent;
};

export const deletePreviewCertHandler = async ({ event }: Params) => {
  if (!event.name) {
    throw new Error('deletePreviewCertHandler. event name is undefined');
  }

  const leafHash = event.name.replace('delete-preview-cert-id-', '');

  const state = await getState(snap);

  const foundCert = state.zkCerts.find((cert) => {
    return cert.zkCert.leafHash === leafHash;
  })?.zkCert;

  if (!foundCert) {
    throw new Error('deletePreviewCertHandler. Cert is not found');
  }

  return <Cert cert={foundCert} withDeleteBanner />;
};
