import { SnapsGlobalObject } from '@metamask/rpc-methods';
import { PanelContent, RpcArgs } from '../types';
import {
  ImportZkCertParams,
  importZkCertParamsSchema,
  ImportZkCertError,
  createError,
} from '@galactica-net/core';
import { getState, saveState } from '../stateManagement';
import { divider, heading, panel, text } from '@metamask/snaps-ui';
import { getZkCertStorageOverview } from '../zkCertHandler';
import { ZodError } from 'zod';

export const importZkCert = async (
  snap: SnapsGlobalObject,
  { request }: RpcArgs,
) => {
  const requestParams = request.params;

  console.log('importZkCert', requestParams);

  createError({ name: 'InvalidRequest', message: 'Parameters are required' });

  if (!requestParams) {
    return new ImportZkCertError({
      name: 'InvalidRequest',
      message: 'Parameters are required',
    });
  }

  let params: ImportZkCertParams;
  try {
    console.log('parse params');
    params = importZkCertParamsSchema.parse(requestParams);
  } catch (error) {
    if (error instanceof ZodError) {
      console.log(error.errors);
      throw new ImportZkCertError({
        name: 'InvalidRequest',
        message: 'Invalid',
      });
    }
  }

  console.log('parsedSchema', params);

  const state = await getState(snap);

  console.log('received state', state);

  // check that there is a holder setup for this zkCert
  const searchedHolder = state.holders.find(
    (candidate) =>
      candidate.holderCommitment === params.zkCert.holderCommitment,
  );

  if (searchedHolder === undefined) {
    return new ImportZkCertError({
      name: 'HolderMissing',
      message: `Could not find Holder for commitment ${params.zkCert.holderCommitment}. Please use Metamask with the same mnemonic as when you created this holder commitment.`,
      cause: request,
    });
  }

  // prevent uploading the same zkCert again
  const searchedZkCert = state.zkCerts.find(
    (candidate) => candidate.leafHash === params.zkCert.leafHash,
  );
  if (searchedZkCert) {
    return new ImportZkCertError({
      name: 'AlreadyImported',
      message: 'This zkCert has already been imported. Skipping it.',
    });
  }

  const prompt: PanelContent = [
    heading('Import your zkCertificate into your MetaMask'),
    text(
      `With this action you are importing your zkKYC in your MetaMask in order to generate ZK proofs. ZK proofs are generated using the Galactica Snap.`,
    ),
    divider(),
    text(
      `The application also requests to get an overview of zkCertificates stored in your MetaMask. This overview does not contain personal information, only metadata (expiration date of the document, issue, and verification level).`,
    ),
  ];

  const confirm = await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: panel(prompt),
    },
  });

  if (!confirm) {
    return new ImportZkCertError({
      name: 'RejectedConfirm',
      message: 'User rejected confirmation.',
      cause: request,
    });
  }

  state.zkCerts.push(params.zkCert);

  await saveState(snap, state);

  return getZkCertStorageOverview(state.zkCerts);
};
