import { GalacticaBaseError, GalacticaBaseResponse } from './base';

// Response
export type GetZkCertHashesResponse = GalacticaBaseResponse<string[]>;

// Error
type ErrorName = 'RejectedConfirm';
export class GetZkCertHashesError extends GalacticaBaseError<ErrorName> {}
