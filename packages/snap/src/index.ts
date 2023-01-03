import { OnRpcRequestHandler } from '@metamask/snap-types';
import { eddsaKeyGenerationMessage } from 'zkkyc';

import { generateZkKycProof } from './proofGenerator';
import { getState, saveState } from './stateManagement';
import {
  ExportRequestParams,
  GenZkKycRequestParams,
  HolderData,
  ImportRequestParams,
  RpcMethods,
} from './types';
import { shortenAddrStr } from './utils';
import { calculateHolderCommitment } from './zkCertHandler';
import { selectZkCert } from './zkCertSelector';

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns `null` if the request succeeded.
 * @throws If the request method is not valid for this snap.
 * @throws If the `snap_confirm` call failed.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request,
}) => {
  console.log('got request', request.method);

  const state = await getState();
  let confirm: any;
  let responseMsg: string;
  let holder: HolderData;

  switch (request.method) {
    case RpcMethods.setupHoldingKey:
      // inform user how setup works
      await wallet.request({
        method: 'snap_notify',
        params: [
          {
            type: 'inApp',
            message: `Connect to the Metamask address holding zkCerts.`,
          },
        ],
      });

      const newAccounts = (await wallet.request({
        method: 'eth_requestAccounts',
      })) as string[];
      const newHolder = newAccounts[0];
      console.log('Holder to be added:', newHolder);

      // TODO: Do we need the 0x prefix?
      const msg = `0x${Buffer.from(eddsaKeyGenerationMessage, 'utf8').toString(
        'hex',
      )}`;
      const sign = (await wallet.request({
        method: 'personal_sign',
        params: [msg, newHolder],
      })) as string;

      if (state.holders.find((holder) => holder.address === newHolder)) {
        responseMsg = `${shortenAddrStr(newHolder)} already added.`;
      } else {
        state.holders.push({
          address: newHolder,
          holderCommitment: await calculateHolderCommitment(sign),
          eddsaKey: sign,
        });
        await saveState({ holders: state.holders, zkCerts: state.zkCerts });
        responseMsg = `Added holder ${shortenAddrStr(newHolder)}`;
      }
      return responseMsg;

    case RpcMethods.genZkKycProof:
      // parse ZKP inputs
      const genParams = request.params as GenZkKycRequestParams;
      // TODO: check input validity

      // ask user to confirm
      confirm = await wallet.request({
        method: 'snap_confirm',
        params: [
          {
            prompt: 'Generate zkCert proof?',
            description: 'Galactica zkKYC proof creation.',
            // TODO: list disclosed information
            textAreaContent: `Do you want to prove your identity to ${origin}?
            This will create a zkKYC proof.
            It discloses the following information publicly:
            - That you hold a KYC
            - That you are above ${genParams.input.ageThreshold} years old
            - ...
            The following private inputs are processed by the zkSNARK and stay hidden:
            - KYC id
            - inputs (e.g. year of birth)
            - ...`,
          },
        ],
      });

      if (!confirm) {
        throw new Error('User rejected confirmation.');
      }

      const zkCert = await selectZkCert(state.zkCerts, genParams.requirements);

      holder = state.holders.find(
        (holder) => holder.holderCommitment === zkCert.holderCommitment,
      )!;
      if (holder === undefined) {
        throw new Error(
          `Holder for commitment ${zkCert.holderCommitment} could not be found. Please connect the snap to that address to import the corresponding holder.`,
        );
      }

      // TODO: think of mechanism to preserve privacy by not using the same merkle proof every time
      const { merkleProof } = state.zkCerts.find(
        (cert) => cert.leafHash === zkCert.leafHash,
      )!;

      const proof = generateZkKycProof(genParams, zkCert, holder, merkleProof);
      return proof;

    case RpcMethods.clearStorage:
      confirm = await wallet.request({
        method: 'snap_confirm',
        params: [
          {
            prompt: 'Clear zkCert and holder storage?',
            description: 'Galactica zkCert storage clearing',
            textAreaContent: `Do you want to delete the zkCertificates and holder information stored in Metamask? (requested by ${origin})`,
          },
        ],
      });
      if (!confirm) {
        throw new Error('User rejected confirmation.');
      }

      await saveState({ holders: [], zkCerts: [] });
      return 'zkCert storage cleared';

    case RpcMethods.importZkCert:
      const importParams = request.params as ImportRequestParams;

      // TODO: check that there is a holder setup for this zkCert

      confirm = await wallet.request({
        method: 'snap_confirm',
        params: [
          {
            prompt: 'Import zkCert?',
            description: 'Galactica zkKYC import.',
            textAreaContent: `Do you want to import the following zkCert? (provided through ${origin})
            ${importParams.zkCert.did}
            `,
          },
        ],
      });
      if (!confirm) {
        throw new Error('User rejected confirmation.');
      }
      state.zkCerts.push(importParams.zkCert);
      await saveState(state);
      return 'zkCert added to storage';

    case RpcMethods.exportZkCert:
      const exportParams = request.params as ExportRequestParams;

      confirm = await wallet.request({
        method: 'snap_confirm',
        params: [
          {
            prompt: 'Import zkCert?',
            description: 'Galactica zkKYC import.',
            textAreaContent: `Do you want to export a zkCert? (provided to ${origin} for saving it to a file)
            `,
          },
        ],
      });
      if (!confirm) {
        throw new Error('User rejected confirmation.');
      }

      const zkCertForExport = await selectZkCert(state.zkCerts, {
        zkCertStandard: exportParams.zkCertStandard,
      });
      return zkCertForExport;

    case RpcMethods.getHolderCommitment:
      if (state.holders.length === 0) {
        throw new Error(
          'No holders imported. Please import a holding address first.',
        );
      }

      // TODO: holder selection if multiple holders are available
      holder = state.holders[0];

      confirm = await wallet.request({
        method: 'snap_confirm',
        params: [
          {
            prompt: 'Provide holder commitment?',
            description: 'First step to get a zkCert from a provider.',
            textAreaContent: `Do you want to provide your holder commitment of ${holder.address} to ${origin}?`,
          },
        ],
      });
      if (!confirm) {
        throw new Error('User rejected confirmation.');
      }

      return holder.holderCommitment;

    default:
      throw new Error('Method not found.');
  }
};
