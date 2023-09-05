import { z } from 'zod';

import { registeredZkCertSchema } from '../common';
import { GalacticaBaseError, GalacticaBaseResponse } from './base';

// Req Params
export const importZkCertParamsSchema = z.object({
  zkCert: registeredZkCertSchema,
});

export type ImportZkCertParams = z.infer<typeof importZkCertParamsSchema>;

// Response

export type ImportZkCertResponse = GalacticaBaseResponse<any>;

// Errors
type ErrorName =
  | 'RejectedConfirm'
  | 'HolderMissing'
  | 'AlreadyImported'
  | 'InvalidRequest';

export class ImportZkCertError extends GalacticaBaseError<ErrorName> {}
