import { OnRpcRequestHandler } from '@metamask/snap-types';

import { generateZkKycProof } from './proofGenerator';
import { GenZkKycRequestParams, RpcMethods } from './types';
import { getState, saveState } from './stateManagement';


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

  switch (request.method) {

    case RpcMethods.genZkKycProof:
      // parse ZKP inputs
      const params = request.params as GenZkKycRequestParams;
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
            - That you are above ${params.input.ageThreshold} years old
            - ...
            The following private inputs are processed by the zkSNARK and stay hidden:
            - KYC id
            - inputs (e.g. year of birth ${params.input.yearOfBirth})
            - ...`,
          },
        ],
      });
      if (!confirm) {
        throw new Error('User rejected confirmation.');
      }
      
      const proof = generateZkKycProof(params);
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

      await saveState({ zkCerts: [] });
      return "zkCert storage cleared";
    
    case RpcMethods.importZkCert:
      // TODO: implement
      throw new Error('Not implemented yet.');
    case RpcMethods.exportZkCert:
      // TODO: implement
      throw new Error('Not implemented yet.');


    default:
      throw new Error('Method not found.');
  }
};
