// Response

import { ZkCertStandard } from '../common';
import { GalacticaBaseResponse } from './base';

export type GetZkCertStorageHashesResponse = GalacticaBaseResponse<
  Record<ZkCertStandard, string>
>;
