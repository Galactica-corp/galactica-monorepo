import { OnRpcRequestHandler } from '@metamask/snap-types';

import { generateZkKycProof } from './proofGenerator';
import { ExportRequestParams, GenZkKycRequestParams, ImportRequestParams, RpcMethods } from './types';
import { getState, saveState } from './stateManagement';
import { selectZkCert } from './zkCertSelector';
import { shortenAddrStr } from './utils';


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
export const onRpcRequest: OnRpcRequestHandler = async ({ origin, request }) => {
  console.log("got request", request.method);

  let state = await getState();
  let confirm : any;
  let responseMsg : string;

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

      const newAccounts = await wallet.request({
        method: 'eth_requestAccounts',
      }) as string[];
      const newHolder = newAccounts[0];
      console.log("Holder to be added:", newHolder);
      
      // TODO: utilize zkKYC repo to get message
      const msg = `0x${Buffer.from("TODO: add message", 'utf8').toString('hex')}`;
      const sign = await wallet.request({
        method: 'personal_sign',
        params: [msg, newHolder],
      }) as string;
      
      if (state.holders.find((holder) => holder.address === newHolder)) {
        responseMsg = `${shortenAddrStr(newHolder)} already added.`;        
      }
      else {
        state.holders.push({ address: newHolder, holderCommitment: "TODO: add commitment", eddsaKey: sign });
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
            prompt: "Generate zkCert proof?",
            description:
            'Galactica zkKYC proof creation.',
            // TODO: list disclosed information
            textAreaContent:
            `Do you want to prove your identity to ${origin}?
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

      const proof = generateZkKycProof(genParams, zkCert);
      return proof;

    case RpcMethods.clearStorage:
      confirm = await wallet.request({
        method: 'snap_confirm',
        params: [
          {
            prompt: "Clear zkCert storage?",
            description:
            'Galactica zkCert storage clearing',
            textAreaContent:
            `Do you want to delete the zkCertificates stored in Metamask? (requested by ${origin})`,
          },
        ],
      });
      if (!confirm) {
        throw new Error('User rejected confirmation.');
      }

      await saveState({ holders: state.holders, zkCerts: [] });
      return "zkCert storage cleared";
    
    case RpcMethods.importZkCert:
      const importParams = request.params as ImportRequestParams;

      // TODO: check that there is a holder setup for this zkCert

      confirm = await wallet.request({
        method: 'snap_confirm',
        params: [
          {
            prompt: "Import zkCert?",
            description:
            'Galactica zkKYC import.',
            textAreaContent:
            `Do you want to import the followingimport { shortenAddrStr } from './utils';
 zkCert? (provided through ${origin})
            ${JSON.stringify(importParams.zkCert, null, 2)}
            `,
          },
        ],
      });
      if (!confirm) {
        throw new Error('User rejected confirmation.');
      }
      state.zkCerts.push(importParams.zkCert);
      await saveState(state);
      return "zkCert added to storage";

    case RpcMethods.exportZkCert:
      const exportParams = request.params as ExportRequestParams;

      confirm = await wallet.request({
        method: 'snap_confirm',
        params: [
          {
            prompt: "Import zkCert?",
            description:
            'Galactica zkKYC import.',
            textAreaContent:
            `Do you want to export a zkCert? (provided to ${origin} for saving it to a file)
            `,
          },
        ],
      });
      if (!confirm) {
        throw new Error('User rejected confirmation.');
      }

      const zkCertForExport = await selectZkCert(state.zkCerts, {zkCertStandard: exportParams.zkCertStandard});
      return zkCertForExport;

    default:
      throw new Error('Method not found.');
  }
};
