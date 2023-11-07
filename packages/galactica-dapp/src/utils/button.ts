import { isLocalSnap } from '@galactica-net/snap-api';

import type { Snap } from '../types';

export const shouldDisplayReconnectButton = (installedSnap?: Snap) =>
  installedSnap && isLocalSnap(installedSnap?.id);
