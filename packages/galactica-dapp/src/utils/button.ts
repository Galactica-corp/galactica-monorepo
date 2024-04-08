import { isLocalSnap } from '@galactica-net/snap-api';

import type { Snap } from '../types';

export const shouldDisplayReconnectButton = (installedSnap?: Snap) =>
  // if there is an installed snap, we always want to show the reconnect button
  !!installedSnap;
