import { z } from 'zod';

import { zkCertStandards } from '../common';
import { GalacticaBaseError, GalacticaBaseResponse } from './base';

// Req params
export const deleteZkCertParamsSchema = z.object({
  zkCertStandard: z.enum(zkCertStandards).optional(),
  expirationDate: z.union([z.string().datetime(), z.number()]).optional(),
  providerAx: z.string().optional(),
});

export type DeleteZkCertParams = z.infer<typeof deleteZkCertParamsSchema>;

// Response
export type DeleteZkCertResponse = GalacticaBaseResponse<boolean>;

// Error
type ErrorName = 'RejectedConfirm' | 'NotFound';
export class DeleteZkCertError extends GalacticaBaseError<ErrorName> {}
