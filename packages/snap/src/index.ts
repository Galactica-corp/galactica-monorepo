import { OnRpcRequestHandler } from '@metamask/snap-types';
import { generateZkKycProof } from './proofGenerator';
import { GenZkKycRequestParams, RpcMethods } from './types';

/**
 * Get a message from the origin. For demonstration purposes only.
 *
 * @param originString - The origin string.
 * @returns A message based on the origin.
 */
export const getMessage = (originString: string): string =>
  `Hello, ${originString}!`;

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
  switch (request.method) {
    // TODO: create method for ZKP
    case RpcMethods.genZkKycProof:
      // parse ZKP inputs
      const params = request.params as GenZkKycRequestParams;
      // TODO: check input validity

      // ask user to confirm
      const confirm = await wallet.request({
        method: 'snap_confirm',
        params: [
          {
            prompt: getMessage(origin),
            description:
            'Galactica zkKYC proof creation.',
            // TODO: list disclosed information
            textAreaContent:
            `Do you want to prove your identity to ${origin}?
            This will create a zkKYC proof.
            It discloses the following information publicly:
            - That you hold a KYC
            - Your KYC expiration date (${params.expirationDate})
            - ...
            The following private inputs are processed by the zkSNARK and stay hidden:
            - KYC id
            - ...`,
          },
        ],
      });
      if (!confirm) {
        throw new Error('User rejected confirmation.');
      }
      
      const proof = generateZkKycProof(params);
      return proof;
      
    default:
      throw new Error('Method not found.');
  }
};
