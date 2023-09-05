// SPDX-License-Identifier: BUSL-1.1
import '@total-typescript/ts-reset/dist/array-includes';
import { OnRpcRequestHandler } from '@metamask/snaps-types';

import * as handlers from './handlers';
import { SnapRpcProcessor } from './types';
import { GalacticaMethod, galacticaMethods } from '@galactica-net/core';

/**
 * Handler for the rpc request that processes real requests and unit tests alike.
 * It has all inputs as function parameters instead of relying on global variables.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @param snap - The SnapProvider (snap).
 * @returns `null` if the request succeeded.
 * @throws If the request method is not valid for this snap.
 * @throws If the `snap_dialog` call failed.
 */
export const processRpcRequest: SnapRpcProcessor = async (
  { request },
  snap,
) => {
  console.log('REQUEST', request);

  if (!galacticaMethods.includes(request.method))
    throw new Error('Method not found.');

  const method = request.method as GalacticaMethod;

  const handler = handlers[method];

  return await handler(snap, {
    origin,
    request,
  });
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
  console.log('REQUEST', request);

  return await processRpcRequest({ request, origin }, snap);
};
