import { ListZkCertsError, ListZkCertsResponse } from '@galactica-net/core';
import { invokeSnap } from '../utils/invoke-snap';

/**
 * Requests overview of zkCertificates held in the Snap for management.
 */
export const listZkCerts = async () => {
  const response: ListZkCertsResponse = await invokeSnap({
    method: 'listZkCerts',
  });
  return response;
};

export const isListZkCertsError = (error: unknown): error is ListZkCertsError =>
  error instanceof ListZkCertsError;
