import { StartPage } from '../components/startPage';
import { getState } from '../stateManagement';
import { activeTabStore } from '../stores';

export const defaultHandler = async () => {
  const state = await getState(snap);
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
