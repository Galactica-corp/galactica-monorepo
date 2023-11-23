import { isLocalSnap } from '@galactica-net/snap-api';

import { Snap } from '../types';

export const shouldDisplayReconnectButton = (installedSnap?: Snap) =>
  installedSnap && isLocalSnap(installedSnap?.id);
