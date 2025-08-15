/* eslint-disable @typescript-eslint/ban-ts-comment */
// SPDX-License-Identifier: BUSL-1.1
import type {
  EncryptedZkCert,
  HolderCommitmentData,
} from '@galactica-net/galactica-types';
import type {
  ConfirmationResponse,
  ImportZkCertParams,
  GenZkProofParams,
  MerkleProofUpdateRequestParams,
  ZkCertSelectionParams,
  MerkleProofURLUpdateParams,
  BenchmarkZKPGenParams,
} from '@galactica-net/snap-api';
import {
  RpcResponseErr,
  RpcMethods,
  RpcResponseMsg,
  GenericError,
  URLUpdateError,
  ZkCertStandard,
} from '@galactica-net/snap-api';
import {
  UserInputEventType,
  type OnHomePageHandler,
  type OnUserInputHandler,
} from '@metamask/snaps-sdk';
import type { OnRpcRequestHandler } from '@metamask/snaps-types';
import { panel, text, heading, divider } from '@metamask/snaps-ui';
import { base64ToBytes, bytesToString } from '@metamask/utils';
import type { AnySchema } from 'ajv/dist/2020';
import { basicURLParse } from 'whatwg-url';

import { StartPage } from './components/start-page';
import {
  checkEncryptedZkCertFormat,
  decryptMessageToObject,
  encryptZkCert,
} from './encryption';
import { getMerkleProof } from './merkleProofSelection';
import {
  checkZkCertProofRequest,
  createProofConfirmationPrompt,
  generateProof,
  generateZkCertProof,
} from './proofGenerator';
import { getHolder, getState, getZkCert, saveState } from './stateManagement';
import type { HolderData, SnapRpcProcessor, PanelContent } from './types';
import { stripURLProtocol } from './utils';
import {
  choseSchema,
  getZkCertStorageHashes,
  getZkCertStorageOverview,
  parseZkCert,
} from './zkCertHandler';
import { selectZkCert, filterZkCerts } from './zkCertSelector';

/**
 * Handler for the rpc request that processes real requests and unit tests alike.
 * It has all inputs as function parameters instead of relying on global variables.
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @param snap - The SnapProvider (snap).
 * @param ethereum - The Ethereum provider that is available as global in the snap.
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
  let holder: HolderData;
  let response: ConfirmationResponse;

  switch (request.method as RpcMethods) {
    case RpcMethods.GenZkCertProof: {
      // parse ZKP inputs
      const genParams = request.params as unknown as GenZkProofParams<any>;
      checkZkCertProofRequest(genParams);

      const zkCert = await selectZkCert(snap, state.zkCerts, {
        zkCertStandard: genParams.requirements.zkCertStandard,
        registryAddress: genParams.requirements.registryAddress,
      });
      holder = getHolder(zkCert.holderCommitment, state.holders);

      const searchedZkCert = getZkCert(
        zkCert.leafHash,
        state.zkCerts.map((cert) => cert.zkCert),
      );

      const merkleProof = await getMerkleProof(
        searchedZkCert,
        searchedZkCert.registration.address,
        ethereum,
        state.merkleServiceURL,
      );
      // save merkle proof in zkCert for later use
      searchedZkCert.merkleProof = merkleProof;
      await saveState(snap, state);

      try {
        await snap.request({
          method: 'snap_notify',
          params: {
            type: 'native',
            message: `ZK proof generation running...`,
          },
        });
      } catch (error) {
        // Ignore errors due to rate limiting, the notification is not essential
        if (error.message.includes('currently rate-limited')) {
          console.log('snap_notify failed due to rate limit');
        } else {
          throw error;
        }
      }

      const proof = await generateZkCertProof(
        genParams,
        zkCert,
        holder,
        merkleProof,
      );

      const proofConfirmDialog = createProofConfirmationPrompt(
        genParams,
        proof,
        origin,
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
              `Do you want to delete the zkCertificates stored in Metamask? (requested by ${stripURLProtocol(
                origin,
              )})`,
            ),
          ]),
        },
      });
      if (!confirm) {
        throw new GenericError({
          name: 'RejectedConfirm',
          message: RpcResponseErr.RejectedConfirm,
        });
      }

      await saveState(snap, { holders: [], zkCerts: [] });
      response = { message: RpcResponseMsg.StorageCleared };
      return response;
    }

    case RpcMethods.ImportZkCert: {
      const importParams = request.params as ImportZkCertParams;

      checkEncryptedZkCertFormat(importParams.encryptedZkCert);

      holder = getHolder(
        importParams.encryptedZkCert.holderCommitment,
        state.holders,
      );

      const decrypted = decryptMessageToObject(
        importParams.encryptedZkCert,
        holder.encryptionPrivKey,
      );
      const schema = choseSchema(
        decrypted.zkCertStandard as ZkCertStandard,
        importParams.customSchema as unknown as AnySchema,
      );
      const zkCert = parseZkCert(decrypted, schema);

      // prevent uploading the same zkCert again (it is fine on different registries though)
      const searchedZkCert = state.zkCerts
        .map((cert) => cert.zkCert)
        .find(
          (candidate) =>
            candidate.leafHash === zkCert.leafHash &&
            candidate.registration.address === zkCert.registration.address &&
            candidate.zkCertStandard === zkCert.zkCertStandard,
        );
      if (searchedZkCert) {
        response = { message: RpcResponseMsg.ZkCertAlreadyImported };
        return response;
      }

      const prompt: PanelContent = [
        heading('Import your zkCertificate into your MetaMask'),
        text(
          `With this action you are importing your ${zkCert.zkCertStandard} in your MetaMask in order to generate ZK proofs. ZK proofs are generated using the Galactica Snap.`,
        ),
      ];
      if (importParams.listZkCerts === true) {
        prompt.push(
          divider(),
          text(
            `The application also requests to get an overview of zkCertificates stored in your MetaMask.This overview does not contain personal information, only metadata(expiration date of the document, issue, and verification level).`,
          ),
        );
      }

      confirm = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel(prompt),
        },
      });
      if (!confirm) {
        throw new GenericError({
          name: 'RejectedConfirm',
          message: RpcResponseErr.RejectedConfirm,
        });
      }

      // check if the imported zkCert is a renewal of an existing one
      const oldVersion = state.zkCerts
        .map((cert) => cert.zkCert)
        .find(
          (candidate) =>
            candidate.holderCommitment === zkCert.holderCommitment &&
            candidate.merkleProof.leafIndex === zkCert.merkleProof.leafIndex &&
            candidate.registration.address === zkCert.registration.address &&
            candidate.zkCertStandard === zkCert.zkCertStandard,
        );
      if (oldVersion) {
        const confirmRenewal = await snap.request({
          method: 'snap_dialog',
          params: {
            type: 'confirmation',
            content: panel([
              text(
                `This zkCert looks like a renewed version of an existing one(${oldVersion.did}).`,
              ),
              text(`Do you want to replace the existing one ? `),
            ]),
          },
        });
        if (confirmRenewal) {
          state.zkCerts = state.zkCerts.filter(
            (candidate) => candidate.zkCert.leafHash !== oldVersion.leafHash,
          );
        }
      }

      state.zkCerts.push({
        zkCert,
        schema,
      });
      await saveState(snap, state);

      if (importParams.listZkCerts === true) {
        const filteredCerts = filterZkCerts(state.zkCerts, {
          chainID: importParams.chainID,
        });
        return getZkCertStorageOverview(
          filteredCerts.map((cert) => cert.zkCert),
        );
      }
      response = { message: RpcResponseMsg.ZkCertImported };
      return response;
    }

    case RpcMethods.ExportZkCert: {
      const exportParams = request.params as ZkCertSelectionParams;

      confirm = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading('Export zkCert?'),
            text(
              `Do you want to export a zkCert ? (provided to ${stripURLProtocol(
                origin,
              )} for saving it to a file)`,
            ),
          ]),
        },
      });
      if (!confirm) {
        throw new GenericError({
          name: 'RejectedConfirm',
          message: RpcResponseErr.RejectedConfirm,
        });
      }

      // get existing zkCerts according to the selection filter
      const zkCertForExport = await selectZkCert(
        snap,
        state.zkCerts,
        exportParams,
      );
      const zkCertStorageData = getZkCert(
        zkCertForExport.leafHash,
        state.zkCerts.map((zkCert) => zkCert.zkCert),
      );
      const encryptedZkCert = encryptZkCert(
        zkCertStorageData,
        state.holders[0].encryptionPubKey,
        state.holders[0].holderCommitment,
      );
      return encryptedZkCert;
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
              `Do you want to provide your holder commitment to ${stripURLProtocol(
                origin,
              )}?`,
            ),
          ]),
        },
      });
      if (!confirm) {
        throw new GenericError({
          name: 'RejectedConfirm',
          message: RpcResponseErr.RejectedConfirm,
        });
      }

      const holderCommitmentData: HolderCommitmentData = {
        holderCommitment: holder.holderCommitment,
        encryptionPubKey: holder.encryptionPubKey,
      };
      return holderCommitmentData;
    }

    case RpcMethods.ListZkCerts: {
      const listParams = request.params as ZkCertSelectionParams;

      // This method returns a list of zkCertificate details so that a front-end can help the user to identify imported zkCerts and whether they are still valid.
      // The data contains expiration date, issuer and verification level. We ask for confirmation to prevent tracking of users.
      confirm = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading(
              'Provide the list of your zkCertificates to the application',
            ),
            text(
              `The application "${stripURLProtocol(
                origin,
              )}" requests to get an overview of zkCertificates stored in your MetaMask.This overview does not contain personal information, only metadata(expiration date of the document, issue, and verification level).`,
            ),
          ]),
        },
      });
      if (!confirm) {
        throw new GenericError({
          name: 'RejectedConfirm',
          message: RpcResponseErr.RejectedConfirm,
        });
      }
      const filteredCerts = filterZkCerts(state.zkCerts, listParams);
      return getZkCertStorageOverview(
        filteredCerts.map((zkCert) => zkCert.zkCert),
      );
    }

    case RpcMethods.GetZkCertStorageHashes: {
      // This method only returns a single hash of the storage state. It can be used to detect changes, for example if the user imported another zkCert in the meantime.
      // Because it does not leak any personal or tracking data, we do not ask for confirmation.
      return getZkCertStorageHashes(
        state.zkCerts.map((zkCert) => zkCert.zkCert),
        origin,
      );
    }

    case RpcMethods.GetZkCertHash: {
      confirm = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading('Provide zkCert hash?'),
            text(
              `Do you want to provide the leaf hashes of your zkCerts to ${stripURLProtocol(
                origin,
              )}?`,
            ),
            text(
              `We suggest doing this only to update Merkle proofs.Only Do this on sites you trust to handle the unique ID of your zkCert confidentially.`,
            ),
          ]),
        },
      });
      if (!confirm) {
        throw new GenericError({
          name: 'RejectedConfirm',
          message: RpcResponseErr.RejectedConfirm,
        });
      }

      return state.zkCerts.map((zkCert) => zkCert.zkCert.leafHash);
    }

    // To preserve privacy by not using the same merkle proof every time, the merkle proof can be updated.
    case RpcMethods.UpdateMerkleProof: {
      const merkleUpdateParams =
        request.params as MerkleProofUpdateRequestParams;

      confirm = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading('Update Merkle proofs?'),
            text(
              `Do you want to update the merkle proofs of your zkCerts as suggested by ${stripURLProtocol(
                origin,
              )}?`,
            ),
          ]),
        },
      });
      if (!confirm) {
        throw new GenericError({
          name: 'RejectedConfirm',
          message: RpcResponseErr.RejectedConfirm,
        });
      }

      for (const update of merkleUpdateParams.updates) {
        let foundZkCert = false;
        for (const zkCert of state.zkCerts.map((cert) => cert.zkCert)) {
          if (
            zkCert.leafHash === update.proof.leaf &&
            zkCert.registration.address === update.registryAddr
          ) {
            zkCert.merkleProof = update.proof;
            foundZkCert = true;
            break;
          }
        }
        if (!foundZkCert) {
          throw new Error(
            `The zkCert with leaf hash ${update.proof.leaf} was not found in the wallet. Please import it before updating the Merkle proof.`,
          );
        }
      }

      await saveState(snap, state);

      response = { message: RpcResponseMsg.MerkleProofsUpdated };
      return response;
    }

    case RpcMethods.DeleteZkCert: {
      const deleteParams = request.params as ZkCertSelectionParams;

      // get existing zkCerts that fit to the delete filter
      const zkCertToDelete = await selectZkCert(
        snap,
        state.zkCerts,
        deleteParams,
      );

      confirm = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading('Delete zkCert?'),
            text(`Do you want to delete the following zkCert from MetaMask ? `),
            text(`${zkCertToDelete.did} `),
          ]),
        },
      });
      if (!confirm) {
        throw new GenericError({
          name: 'RejectedConfirm',
          message: RpcResponseErr.RejectedConfirm,
        });
      }

      state.zkCerts = state.zkCerts.filter(
        (zkCert) => zkCert.zkCert.leafHash !== zkCertToDelete.leafHash,
      );
      await saveState(snap, state);

      response = { message: RpcResponseMsg.ZkCertDeleted };
      return response;
    }

    case RpcMethods.UpdateMerkleProofURL: {
      const urlUpdateParams = request.params as MerkleProofURLUpdateParams;

      // check if the URL is secure
      if (!urlUpdateParams.url.startsWith('https://')) {
        throw new URLUpdateError({
          name: 'OnlyHTTPS',
          message: `The URL ${urlUpdateParams.url} is not secure.Please use a secure URL(starting with https://).`,
        });
      }

      // check if URL is a valid URL
      if (!basicURLParse(urlUpdateParams.url)) {
        throw new URLUpdateError({
          name: 'InvalidURL',
          message: `The URL ${urlUpdateParams.url} is not a valid URL.`,
        });
      }
      if (!urlUpdateParams.url.endsWith('/')) {
        throw new URLUpdateError({
          name: 'TrailingSlashMissing',
          message: `The URL ${urlUpdateParams.url} is missing a trailing slash.`,
        });
      }

      confirm = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading('Update Merkle Proof Service?'),
            text(
              `Do you want to update the URL to get Merkle Proofs from to '${urlUpdateParams.url}'?`,
            ),
          ]),
        },
      });
      if (!confirm) {
        throw new GenericError({
          name: 'RejectedConfirm',
          message: RpcResponseErr.RejectedConfirm,
        });
      }

      state.merkleServiceURL = urlUpdateParams.url;
      await saveState(snap, state);
      response = { message: RpcResponseMsg.MerkleProofsUpdated };
      return response;
    }

    case RpcMethods.BenchmarkZKPGen: {
      // parse ZKP inputs
      const genParams = request.params as unknown as BenchmarkZKPGenParams;

      confirm = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading('Allow Benchmark?'),
            text(
              'Do you allow the snap to run a benchmark of ZK proof generation?',
            ),
          ]),
        },
      });

      if (!confirm) {
        throw new Error(RpcResponseErr.RejectedConfirm);
      }

      const startTime = Date.now();
      const proof = await generateProof(genParams.input, genParams.prover);
      const endTime = Date.now();
      const duration = endTime - startTime;

      await snap.request({
        method: 'snap_notify',
        params: {
          type: 'native',
          message: `ZKP generation benchmark took ${duration}ms`,
        },
      });

      return proof;
    }

    default: {
      throw new Error(RpcResponseErr.UnknownMethod);
    }
  }
};

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns The result of the request.
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

/**
 * Handle incoming user events coming from the MetaMask clients open interfaces.
 * @param params - The event parameters.
 * @param params.id - The Snap interface ID where the event was fired.
 * @param params.event - The event object containing the event type, name and value.
 * @see https://docs.metamask.io/snaps/reference/exports/#onuserinput
 */
export const onUserInput: OnUserInputHandler = async ({ id, event }) => {
  const state = await getState(snap);

  if (
    event.type === UserInputEventType.FileUploadEvent &&
    event.file !== null
  ) {
    try {
      const encryptedZkCert: EncryptedZkCert = JSON.parse(
        bytesToString(base64ToBytes(event.file.contents)),
      );
      checkEncryptedZkCertFormat(encryptedZkCert);

      const holder = getHolder(encryptedZkCert.holderCommitment, state.holders);

      const decrypted = decryptMessageToObject(
        encryptedZkCert,
        holder.encryptionPrivKey,
      );
      const schema = choseSchema(decrypted.zkCertStandard as ZkCertStandard);

      const zkCert = parseZkCert(decrypted, schema);
      const searchedZkCert = state.zkCerts.find(
        (candidate) =>
          candidate.zkCert.leafHash === zkCert.leafHash &&
          candidate.zkCert.registration.address ===
            zkCert.registration.address &&
          candidate.zkCert.zkCertStandard === zkCert.zkCertStandard,
      );
      if (searchedZkCert) {
        throw new Error('This zkCert has already been imported');
      }

      state.zkCerts.push({ zkCert, schema });
      const certs = state.zkCerts.map((cert) => cert.zkCert);
      await saveState(snap, state);
      await snap.request({
        // @ts-ignore
        method: 'snap_updateInterface',
        // @ts-ignore
        params: {
          id,
          ui: (
            <StartPage
              activeTab={zkCert.zkCertStandard}
              zkCerts={certs}
              holders={state.holders.map(
                ({ holderCommitment, encryptionPubKey }) => ({
                  holderCommitment,
                  encryptionPubKey,
                }),
              )}
            />
          ),
        },
      });
      // eslint-disable-next-line id-length
    } catch (e) {
      const error = (e as Error).message;
      const oldCerts = state.zkCerts.map((cert) => cert.zkCert);
      const holders = state.holders.map(
        ({ holderCommitment, encryptionPubKey }) => ({
          encryptionPubKey,
          holderCommitment,
        }),
      );
      await snap.request({
        // @ts-ignore
        method: 'snap_updateInterface',
        // @ts-ignore
        params: {
          id,
          ui: (
            <StartPage
              error={error}
              activeTab={ZkCertStandard.ZkKYC}
              zkCerts={oldCerts}
              holders={holders}
            />
          ),
        },
      });
    }
  }

  if (event.type === UserInputEventType.ButtonClickEvent) {
    let activeTab: ZkCertStandard = ZkCertStandard.ArbitraryData;

    if (event.name?.includes(ZkCertStandard.ZkKYC)) {
      activeTab = ZkCertStandard.ZkKYC;
    }

    if (event.name?.includes(ZkCertStandard.Twitter)) {
      activeTab = ZkCertStandard.Twitter;
    }

    if (event.name?.includes('delete-cert-id')) {
      const leafHash = event.name.replace('delete-cert-id-', '');
      const newCerts = state.zkCerts.filter(
        (cert) => cert.zkCert.leafHash !== leafHash,
      );
      state.zkCerts = newCerts;
      await saveState(snap, state);
    }

    const certs = state.zkCerts.map((cert) => cert.zkCert);
    const holders = state.holders.map(
      ({ holderCommitment, encryptionPubKey }) => ({
        encryptionPubKey,
        holderCommitment,
      }),
    );
    await snap.request({
      // @ts-ignore
      method: 'snap_updateInterface',
      // @ts-ignore
      params: {
        id,
        ui: (
          <StartPage activeTab={activeTab} zkCerts={certs} holders={holders} />
        ),
      },
    });
  }
};

export const onHomePage: OnHomePageHandler = async () => {
  const state = await getState(snap);

  const certs = state.zkCerts.map(({ zkCert }) => zkCert);
  const holders = state.holders.map(
    ({ encryptionPubKey, holderCommitment }) => ({
      encryptionPubKey,
      holderCommitment,
    }),
  );
  return {
    content: (
      <StartPage
        activeTab={ZkCertStandard.ZkKYC}
        zkCerts={certs}
        holders={holders}
      />
    ),
  };
};
