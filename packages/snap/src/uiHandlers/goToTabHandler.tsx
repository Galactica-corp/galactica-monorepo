import type { ButtonClickEvent } from '@metamask/snaps-sdk';

import { StartPage } from '../components/startPage';
import { getState } from '../stateManagement';
import type { TabType } from '../stores';
import { activeTabStore } from '../stores';

type Params = {
  event: ButtonClickEvent;
};

export const goToTabHandler = async ({ event }: Params) => {
  if (!event.name) {
    throw new Error('goToTabHandler. event name is undefined');
  }

  const state = await getState(snap);

  activeTabStore.value = event.name.replace('go-to-tab-', '') as TabType;

  const certs = state.zkCerts.map((cert) => cert.zkCert);
  const holders = state.holders.map(
    ({ holderCommitment, encryptionPubKey }) => ({
      holderCommitment,
      encryptionPubKey,
    }),
  );

  return (
    <StartPage
      activeTab={activeTabStore.value}
      zkCerts={certs}
      holders={holders}
    />
  );
};
