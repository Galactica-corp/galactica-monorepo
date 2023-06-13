import { OnRpcRequestHandler } from '@metamask/snaps-types';
import { panel, text, heading, divider } from '@metamask/snaps-ui';

import { generateZkKycProof } from './proofGenerator';
import { RpcResponseErr, RpcMethods, RpcResponseMsg } from './rpcEnums';
import { getState, saveState } from './stateManagement';
import {
  ExportRequestParams,
  GenZkKycRequestParams,
  HolderData,
  ImportRequestParams,
  SnapRpcProcessor,
} from './types';
import {
  getZkCertStorageHashes,
  getZkCertStorageOverview,
} from './zkCertHandler';
import { selectZkCert } from './zkCertSelector';

/**
 * Handler for the rpc request that processes real requests and unit tests alike.
 * It has all inputs as function parameters instead of relying on global variables.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @param snap - The SnapProvider (snap).
 * @param ethereum - The Ethereum provider for interacting with the ordinary Metamask.
 * @returns `null` if the request succeeded.
 * @throws If the request method is not valid for this snap.
 * @throws If the `snap_dialog` call failed.
 */
export const processRpcRequest: SnapRpcProcessor = async (
  { origin, request },
  snap,
  ethereum,
) => {
  const state = await getState(snap);
  let confirm: any;
  let response: any;
  let holder: HolderData;

  switch (request.method) {
    case RpcMethods.GenZkKycProof: {
      // parse ZKP inputs
      const genParams = request.params as GenZkKycRequestParams<any>;
      // TODO: check input validity

      const proofConfirmDialog = [
        heading('Generate zkCert proof?'),
        text(`Do you want to prove your identity to ${origin}?`),
        text(
          `This will create a ${genParams.requirements.zkCertStandard} proof.`,
        ),
        divider(),
      ];

      // TODO: generalize disclosure of inputs to any kind of inputs
      proofConfirmDialog.push(
        text(`It discloses the following information publicly:`),
        text(
          `That you are at least ${
            genParams.input.ageThreshold as number
          } years old`,
        ),
        text(`The date of generating this proof`),
      );

      proofConfirmDialog.push(
        divider(),
        text(
          `The following private inputs stay hidden: zkKYC ID, personal details that are not listed above`,
        ),
      );

      confirm = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel(proofConfirmDialog),
        },
      });

      if (!confirm) {
        throw new Error(RpcResponseErr.RejectedConfirm);
      }

      const zkCert = await selectZkCert(
        snap,
        state.zkCerts,
        genParams.requirements,
      );

      const searchedHolder = state.holders.find(
        (candidate) => candidate.holderCommitment === zkCert.holderCommitment,
      );
      if (searchedHolder === undefined) {
        throw new Error(
          `Holder for commitment ${zkCert.holderCommitment} could not be found. Please use Metamask with the same mnemonic as when you created this holder commitment.`,
        );
      } else {
        holder = searchedHolder;
      }

      // TODO: think of mechanism to preserve privacy by not using the same merkle proof every time
      const searchedZkCert = state.zkCerts.find(
        (cert) => cert.leafHash === zkCert.leafHash,
      );

      if (searchedZkCert === undefined) {
        throw new Error(
          `zkCert with leafHash ${zkCert.leafHash} could not be found.`,
        );
      }

      const proof = generateZkKycProof(
        genParams,
        zkCert,
        holder,
        searchedZkCert.merkleProof,
      );
      return proof;
    }

    case RpcMethods.ClearStorage: {
      confirm = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading('Clear zkCert and holder storage?'),
            text(
              `Do you want to delete the zkCertificates stored in Metamask? (requested by ${origin})`,
            ),
          ]),
        },
      });
      if (!confirm) {
        throw new Error(RpcResponseErr.RejectedConfirm);
      }

      await saveState(snap, { holders: [], zkCerts: [] });
      return RpcResponseMsg.StorageCleared;
    }

    case RpcMethods.ImportZkCert: {
      const importParams = request.params as ImportRequestParams;

      // TODO: check that there is a holder setup for this zkCert

      confirm = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading('Import zkCertificate?'),
            text(`Do you want to import the following zkCert? (provided through ${origin})
              ${importParams.zkCert.did}`),
          ]),
        },
      });
      if (!confirm) {
        throw new Error(RpcResponseErr.RejectedConfirm);
      }
      state.zkCerts.push(importParams.zkCert);
      await saveState(snap, state);
      return RpcResponseMsg.ZkCertImported;
    }

    case RpcMethods.ExportZkCert: {
      const exportParams = request.params as ExportRequestParams;

      confirm = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading('Export zkCert?'),
            text(
              `Do you want to export a zkCert? (provided to ${origin} for saving it to a file)`,
            ),
          ]),
        },
      });
      if (!confirm) {
        throw new Error(RpcResponseErr.RejectedConfirm);
      }

      const zkCertForExport = await selectZkCert(snap, state.zkCerts, {
        zkCertStandard: exportParams.zkCertStandard,
      });
      const zkCertStorageData = state.zkCerts.find(
        (cert) => cert.leafHash === zkCertForExport.leafHash,
      );

      return zkCertStorageData;
    }

    case RpcMethods.GetHolderCommitment: {
      if (state.holders.length === 0) {
        throw new Error(RpcResponseErr.MissingHolder);
      }

      // Assuming that we have a single holder. Might change when this is implemented: https://github.com/MetaMask/snaps/discussions/1364#discussioncomment-6111359
      holder = state.holders[0];

      confirm = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading('Provide holder commitment?'),
            text(
              `Do you want to provide your holder commitment to ${origin}?`,
            ),
          ]),
        },
      });
      if (!confirm) {
        throw new Error(RpcResponseErr.RejectedConfirm);
      }

      return holder.holderCommitment;
    }

    case RpcMethods.ListZkCerts: {
      confirm = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading('Provide zkCert Storage metadata?'),
            text(
              `The website ${origin} asks to get an overview of zkCerts stored in Metamask. The overview only contains metadata, no personal and no tracking data.`,
            ),
          ]),
        },
      });
      if (!confirm) {
        throw new Error(RpcResponseErr.RejectedConfirm);
      }

      return getZkCertStorageOverview(state.zkCerts);
    }

    case RpcMethods.GetZkCertStorageHashes: {
      // does not need confirmation as it does not leak any personal or trackng data
      return getZkCertStorageHashes(state.zkCerts, origin);
    }

    default: {
      throw new Error(RpcResponseErr.UnknownMethod);
    }
  }
};

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns The result of the request as string. TODO: Use more strict type.
 * @throws If the request method is not valid for this snap.
 * @throws If the `snap_dialog` call failed.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request,
}) => {
  console.log('got request', request.method);

  // forward to common function shared with unit tests
  // passing global objects object from snap environment
  return await processRpcRequest({ origin, request }, snap, ethereum);
};
