import type { ButtonClickEvent } from '@metamask/snaps-sdk';

import { StartPage } from '../components/startPage';
import { getState, saveState } from '../stateManagement';
import { activeTabStore } from '../stores';

type Params = {
  event: ButtonClickEvent;
};

export const deleteCertHandler = async ({ event }: Params) => {
  if (!event.name) {
    throw new Error('Event name is undefined');
  }
  const state = await getState(snap);
  const leafHash = event.name.replace('delete-cert-id-', '');
  const newCerts = state.zkCerts.filter(
    (cert) => cert.zkCert.leafHash !== leafHash,
  );
  state.zkCerts = newCerts;
  await saveState(snap, state);

  const certs = state.zkCerts.map((cert) => cert.zkCert);
  const holders = state.holders.map(
    ({ holderCommitment, encryptionPubKey }) => ({
      encryptionPubKey,
      holderCommitment,
    }),
  );

  return (
    <StartPage
      zkCerts={certs}
      holders={holders}
      activeTab={activeTabStore.value}
    />
  );
};
