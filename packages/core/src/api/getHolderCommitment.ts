import { GalacticaBaseError, GalacticaBaseResponse } from './base';

// Response

export type GetHolderCommitmentResponse = GalacticaBaseResponse<string>;

// Error
type ErrorName = 'MissingHolder' | 'RejectedConfirm';
export class GetHolderCommitmentError extends GalacticaBaseError<ErrorName> {}
