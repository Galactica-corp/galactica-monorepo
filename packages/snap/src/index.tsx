/*
 * Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// SPDX-License-Identifier: BUSL-1.1
import type {
  HolderCommitmentData,
  ZkCertRegistered,
  GenZkProofParams,
} from '@galactica-net/galactica-types';
import type {
  ConfirmationResponse,
  BenchmarkZKPGenParams,
  GetZkCertStorageHashesRequest,
  ImportZkCertParams,
  MerkleProofUpdateRequestParams,
  MerkleProofURLUpdateParams,
  ZkCertSelectionParams,
} from '@galactica-net/snap-api';
import {
  ImportZkCertError,
  GenericError,
  RpcMethods,
  RpcResponseErr,
  RpcResponseMsg,
  URLUpdateError,
} from '@galactica-net/snap-api';
import {
  chooseSchema,
  decryptZkCert,
  encryptZkCert,
  generateProof,
  generateZkCertProof,
} from '@galactica-net/zk-certificates';
import type {
  OnHomePageHandler,
  OnRpcRequestHandler,
  OnUserInputHandler,
} from '@metamask/snaps-sdk';
import { UserInputEventType } from '@metamask/snaps-sdk';
import { Box, Heading, Text, type JSXElement } from '@metamask/snaps-sdk/jsx';
import type { AnySchema } from 'ajv/dist/2020';
import { basicURLParse } from 'whatwg-url';

import { checkEncryptedZkCertFormat } from './encryption';
import { getMerkleProof } from './merkleProofSelection';
import {
  checkZkCertProofRequest,
  createProofConfirmationPrompt,
} from './proofGenerator';
import {
  CURRENT_STORAGE_LAYOUT_VERSION,
  getHolder,
  getState,
  getZkCert,
  saveState,
} from './stateManagement';
import type { HolderData, SnapRpcProcessor } from './types';
import { cancelDeleteCertHandler } from './uiHandlers/cancelDeleteCertHandler';
import { certUploadHandler } from './uiHandlers/certUploadHandler';
import { defaultHandler } from './uiHandlers/defaultHandler';
import { deleteCertHandler } from './uiHandlers/deleteCertHandler';
import { deletePreviewCertHandler } from './uiHandlers/deletePreviewCertHandler';
import { goToTabHandler } from './uiHandlers/goToTabHandler';
import { viewCertHandler } from './uiHandlers/viewCertHandler';
import { getGuardianInfo } from './utils/getGuardianInfo';
import { stripURLProtocol } from './utils/utils';
import {
  getZkCertStorageHashes,
  getZkCertStorageOverview,
} from './zkCertHandler';
import { filterZkCerts, selectZkCert } from './zkCertSelector';

/**
 * Handler for the rpc request that processes real requests and unit tests alike.
 * It has all inputs as function parameters instead of relying on global variables.
 *
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
        holder.eddsaKey,
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
          content: <Box>{proofConfirmDialog}</Box>,
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
          content: (
            <Box>
              <Heading>Clear zkCert and holder storage?</Heading>
              <Text>
                Do you want to delete the zkCertificates stored in Metamask?
                (requested by {stripURLProtocol(origin)})
              </Text>
            </Box>
          ),
        },
      });
      if (!confirm) {
        throw new GenericError({
          name: 'RejectedConfirm',
          message: RpcResponseErr.RejectedConfirm,
        });
      }

      await saveState(snap, {
        holders: [],
        zkCerts: [],
        storageLayoutVersion: CURRENT_STORAGE_LAYOUT_VERSION,
      });
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

      const customSchema = importParams.customSchema as unknown as AnySchema; // BUG: This is wrong, it might need to be parsed from string.

      const zkCert = (() => {
        try {
          return decryptZkCert(
            importParams.encryptedZkCert,
            holder.encryptionPrivKey,
            customSchema,
          ) as ZkCertRegistered<
            Record<string, string | number | boolean | null>
          >;
        } catch (error) {
          const message = error instanceof Error ? error.message : `${error}`;
          throw new ImportZkCertError({
            name: 'FormatError',
            message,
          });
        }
      })();

      const schema = chooseSchema(zkCert.zkCertStandard, customSchema);

      // prevent uploading the same zkCert again (it is fine on different registries though)
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
        response = { message: RpcResponseMsg.ZkCertAlreadyImported };
        return response;
      }

      const prompt = (
        <Box>
          <Heading>Import your zkCertificate into your MetaMask</Heading>
          <Text>
            With this action you are importing your {zkCert.zkCertStandard} in
            your MetaMask in order to generate ZK proofs. ZK proofs are
            generated using the Galactica Snap.
          </Text>
        </Box>
      );
      confirm = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: prompt,
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
            content: (
              <Box>
                <Text>
                  This zkCert looks like a renewed version of an existing one(
                  {oldVersion.did}).
                </Text>
                <Text>Do you want to replace the existing one ? </Text>
              </Box>
            ),
          },
        });
        if (confirmRenewal) {
          state.zkCerts = state.zkCerts.filter(
            (candidate) => candidate.zkCert.leafHash !== oldVersion.leafHash,
          );
        }
      }

      const newCert: ZkCertRegistered<
        Record<string, string | number | boolean | null>
      > = {
        ...zkCert,
      };
      const guardianInfo = await getGuardianInfo(zkCert, ethereum);

      if (!guardianInfo) {
        throw new Error(`Failed to load information about issuer`);
      }

      if (!guardianInfo.isWhitelisted) {
        throw new Error(
          'The issuer of the provided zkCertificate is not currently whitelisted',
        );
      }

      newCert.providerData = {
        ...zkCert.providerData,
        meta: guardianInfo?.data,
      };

      state.zkCerts.push({
        zkCert: newCert,
        schema,
      });
      await saveState(snap, state);

      return getZkCertStorageOverview([zkCert])[0];
    }

    case RpcMethods.ExportZkCert: {
      const exportParams = request.params as ZkCertSelectionParams;

      confirm = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: (
            <Box>
              <Heading>Export zkCert?</Heading>
              <Text>
                Do you want to export a zkCert ? (provided to{' '}
                {stripURLProtocol(origin)} for saving it to a file)
              </Text>
            </Box>
          ),
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
          content: (
            <Box>
              <Heading>Provide holder commitment?</Heading>
              <Text>
                Do you want to provide your holder commitment to{' '}
                {stripURLProtocol(origin)}?
              </Text>
            </Box>
          ),
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

      const filteredCerts = filterZkCerts(state.zkCerts, listParams);
      return getZkCertStorageOverview(
        filteredCerts.map((zkCert) => zkCert.zkCert),
      );
    }

    case RpcMethods.GetZkCertStorageHashes: {
      // This method only returns a single hash of the storage state. It can be used to detect changes, for example if the user imported another zkCert in the meantime.
      // Because it does not leak any personal or tracking data, we do not ask for confirmation.

      const params = request.params as
        | GetZkCertStorageHashesRequest
        | undefined;

      const chainID = params?.chainID;
      const certs = state.zkCerts.map((storage) => storage.zkCert);
      const filteredCerts = chainID
        ? certs.filter((cert) => cert.registration.chainID === chainID)
        : certs;

      return getZkCertStorageHashes(filteredCerts, origin);
    }

    case RpcMethods.GetZkCertHash: {
      confirm = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: (
            <Box>
              <Heading>Provide zkCert hash?</Heading>
              <Text>
                Do you want to provide the leaf hashes of your zkCerts to{' '}
                {stripURLProtocol(origin)}?
              </Text>
              <Text>
                We suggest doing this only to update Merkle proofs.Only Do this
                on sites you trust to handle the unique ID of your zkCert
                confidentially.
              </Text>
            </Box>
          ),
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
          content: (
            <Box>
              <Heading>Update Merkle proofs?</Heading>
              <Text>
                Do you want to update the merkle proofs of your zkCerts as
                suggested by {stripURLProtocol(origin)}?
              </Text>
            </Box>
          ),
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
          content: (
            <Box>
              <Heading>Delete zkCert?</Heading>
              <Text>
                Do you want to delete the following zkCert from MetaMask ?{' '}
              </Text>
              <Text>{zkCertToDelete.did} </Text>
            </Box>
          ),
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
          content: (
            <Box>
              <Heading>Update Merkle Proof Service?</Heading>
              <Text>
                Do you want to update the URL to get Merkle Proofs from to '
                {urlUpdateParams.url}'?
              </Text>
            </Box>
          ),
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
          content: (
            <Box>
              <Heading>Allow Benchmark?</Heading>
              <Text>
                Do you allow the snap to run a benchmark of ZK proof generation?
              </Text>
            </Box>
          ),
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
 *
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
 *
 * @param params - The event parameters.
 * @param params.id - The Snap interface ID where the event was fired.
 * @param params.event - The event object containing the event type, name and value.
 * @see https://docs.metamask.io/snaps/reference/exports/#onuserinput
 */
export const onUserInput: OnUserInputHandler = async (params) => {
  const { event, id } = params;

  let ui: JSXElement | null = null;

  if (event.type === UserInputEventType.FileUploadEvent) {
    ui = await certUploadHandler({ event, id });
  }

  if (event.type === UserInputEventType.ButtonClickEvent) {
    if (event.name?.startsWith('go-to-tab')) {
      ui = await goToTabHandler({ event });
    }

    if (event.name?.startsWith('delete-preview-cert-id')) {
      ui = await deletePreviewCertHandler({ event });
    }

    if (event.name?.startsWith('delete-cert-id')) {
      ui = await deleteCertHandler({ event });
    }

    if (event.name?.startsWith('cancel-delete-cert-id')) {
      ui = await cancelDeleteCertHandler({ event });
    }

    if (event.name?.startsWith('view-cert-id')) {
      ui = await viewCertHandler({ event });
    }
  }

  ui ??= await defaultHandler();

  await snap.request({
    method: 'snap_updateInterface',
    params: {
      id,
      ui,
    },
  });
};

export const onHomePage: OnHomePageHandler = async () => {
  const ui = await defaultHandler();
  return {
    content: ui,
  };
};
