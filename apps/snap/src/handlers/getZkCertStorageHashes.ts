import { SnapsGlobalObject } from '@metamask/rpc-methods';
import { RpcArgs } from '../types';
import { calcZkCertStorageHashes } from '../zkCertHandler';
import { getState } from '../stateManagement';
import { GetZkCertStorageHashesResponse } from '@galactica-net/core';

export const getZkCertStorageHashes = async (
  snap: SnapsGlobalObject,
  { origin }: RpcArgs,
) => {
  const state = await getState(snap);
  // does not need confirmation as it does not leak any personal or tracking data
  const hashes = calcZkCertStorageHashes(state.zkCerts, origin);

  const response: GetZkCertStorageHashesResponse = {
    data: hashes,
  };

  return response;
};
