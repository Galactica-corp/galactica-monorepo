import { Dispatch } from 'react';
import { MetamaskActions, MetamaskDispatch } from '../hooks';

import { ethers } from 'ethers';

import type { Snap } from '../types';
import { defaultSnapOrigin } from '../../../galactica-dapp/src/config/snap';

import {
  connectSnap,
  getSnap,
} from '@galactica-net/snap-api';

export const shouldDisplayReconnectButton = (installedSnap?: Snap) =>
  // if there is an installed snap, we always want to show the reconnect button
  !!installedSnap;

export const handleSnapConnectClick = async (dispatch: Dispatch<MetamaskDispatch>) => {
  try {
    await connectSnap(defaultSnapOrigin);
    const installedSnap = await getSnap(defaultSnapOrigin);

    dispatch({
      type: MetamaskActions.SetInstalled,
      payload: installedSnap,
    });
    dispatch({ type: MetamaskActions.SetInfo, payload: `Connected to Galactica Snap` });
  } catch (e) {
    console.error(e);
    dispatch({ type: MetamaskActions.SetError, payload: e });
  }
};

export const handleWalletConnectClick = async (dispatch: Dispatch<MetamaskDispatch>) => {
  try {
    //@ts-ignore https://github.com/metamask/providers/issues/200
    const provider = new ethers.providers.Web3Provider(window.ethereum);

    // Will open the MetaMask UI
    window.ethereum.request({ method: 'eth_requestAccounts' });
    // TODO: You should disable this button while the request is pending!
    const signer = provider.getSigner();
    console.log('Connected with Metamask to', await signer.getAddress());

    dispatch({
      type: MetamaskActions.SetConnected,
      payload: await signer.getAddress(),
    });
    dispatch({ type: MetamaskActions.SetInfo, payload: `Connected to Metamask` });
  } catch (e) {
    console.error(e);
    dispatch({ type: MetamaskActions.SetError, payload: e });
  }
};