import { GalacticaBaseError, GalacticaBaseResponse } from './base';

// Response
export type ClearStorageResponse = GalacticaBaseResponse<true>;

// Errors
type ClearStorageErrorName = 'RejectedConfirm';

export class ClearStorageError extends GalacticaBaseError<ClearStorageErrorName> {}
