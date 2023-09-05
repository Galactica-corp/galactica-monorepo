import { SharedZkCert, ZkCertStandard } from '../common';
import { GalacticaBaseError, GalacticaBaseResponse } from './base';

// Response
export type ListZkCertsResponse = GalacticaBaseResponse<
  Record<ZkCertStandard, SharedZkCert[] | undefined>
>;

// Error
type ErrorName = 'RejectedConfirm';
export class ListZkCertsError extends GalacticaBaseError<ErrorName> {}
