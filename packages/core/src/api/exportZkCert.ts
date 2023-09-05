import { z } from 'zod';

import { RegisteredZkCert, zkCertStandards } from '../common';
import { GalacticaBaseError, GalacticaBaseResponse } from './base';

// Req Params
export const exportZkCertParamsSchema = z.object({
  zkCertStandard: z.enum(zkCertStandards),
});

export type ExportZkCertParams = z.infer<typeof exportZkCertParamsSchema>;

// Response

export type ExportZkCertResponse = GalacticaBaseResponse<RegisteredZkCert>;

// Errors
type ExportZkCertErrorName = 'RejectedConfirm';

export class ExportZkCertError extends GalacticaBaseError<ExportZkCertErrorName> {}
