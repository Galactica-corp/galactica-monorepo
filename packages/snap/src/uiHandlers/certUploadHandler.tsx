import type {
  EncryptedZkCert,
  ZkCertRegistered,
} from '@galactica-net/galactica-types';
import { ImportZkCertError } from '@galactica-net/snap-api';
import { chooseSchema, decryptZkCert } from '@galactica-net/zk-certificates';
import type { FileUploadEvent, Json } from '@metamask/snaps-sdk';
import { base64ToBytes, bytesToString } from '@metamask/utils';

import { StartPage } from '../components/startPage';
import { checkEncryptedZkCertFormat } from '../encryption';
import { getHolder, getState, saveState } from '../stateManagement';
import { activeTabStore } from '../stores';
import { getGuardianInfo } from '../utils/getGuardianInfo';

type Params = {
  event: FileUploadEvent;
  id: string;
};

export const certUploadHandler = async (params: Params) => {
  const { event, id } = params;
  const state = await getState(snap);

  if (!event.file) {
    throw new ImportZkCertError({
      name: 'FormatError',
      message: 'The imported zkCert does not contain a holder commitment.',
    });
  }

  try {
    await snap.request({
      method: 'snap_updateInterface',
      params: {
        id,
        ui: (
          <StartPage
            zkCerts={state.zkCerts.map((cert) => cert.zkCert)}
            holders={state.holders.map(
              ({ holderCommitment, encryptionPubKey }) => ({
                holderCommitment,
                encryptionPubKey,
              }),
            )}
            activeTab={activeTabStore.value}
            isLoading={true}
          />
        ),
      },
    });

    const encryptedZkCert: EncryptedZkCert = JSON.parse(
      bytesToString(base64ToBytes(event.file.contents)),
    );
    checkEncryptedZkCertFormat(encryptedZkCert);

    const holder = getHolder(encryptedZkCert.holderCommitment, state.holders);
    const zkCert = (() => {
      try {
        return decryptZkCert(
          encryptedZkCert,
          holder.encryptionPrivKey,
        ) as ZkCertRegistered<Record<string, Json>>;
      } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        throw new ImportZkCertError({
          name: 'FormatError',
          message,
        });
      }
    })();

    const schema = chooseSchema(zkCert.zkCertStandard);

    const searchedZkCert:
      | ZkCertRegistered<Record<string, unknown>>
      | undefined = state.zkCerts
      .map((cert) => cert.zkCert)
      .find(
        (candidate) =>
          candidate.leafHash === zkCert.leafHash &&
          candidate.registration.address === zkCert.registration.address &&
          candidate.zkCertStandard === zkCert.zkCertStandard,
      );

    if (searchedZkCert) {
      throw new Error('This zkCert has already been imported');
    }

    const guardianInfo = await getGuardianInfo(zkCert, ethereum);

    if (!guardianInfo) {
      throw new Error(`Failed to load information about issuer`);
    }

    if (!guardianInfo?.isWhitelisted) {
      throw new Error(
        'The issuer of the provided zkCertificate is not currently whitelisted',
      );
    }

    state.zkCerts.push({
      zkCert: {
        ...zkCert,
        content: zkCert.content,
        providerData: { ...zkCert.providerData, meta: guardianInfo.data },
      },
      schema,
    });
    await saveState(snap, state);

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
  } catch (error) {
    const errorMessage = (error as Error).message;
    const oldCerts = state.zkCerts.map((cert) => cert.zkCert);
    const holders = state.holders.map(
      ({ holderCommitment, encryptionPubKey }) => ({
        encryptionPubKey,
        holderCommitment,
      }),
    );

    const errMessage = errorMessage.includes(
      'The content does not fit to the schema',
    )
      ? 'The imported zkCertificate does not match any supported types'
      : errorMessage;

    return (
      <StartPage
        error={errMessage}
        activeTab={activeTabStore.value}
        zkCerts={oldCerts}
        holders={holders}
      />
    );
  }
};
