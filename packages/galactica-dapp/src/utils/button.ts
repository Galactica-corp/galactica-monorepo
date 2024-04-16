import { connectSnap, getSnap } from '@galactica-net/snap-api';
import { ethers } from 'ethers';
import type { Dispatch } from 'react';

import { defaultSnapOrigin } from '../config/snap';
import type { MetamaskDispatch } from '../hooks';
import { MetamaskActions } from '../hooks';
import type { Snap } from '../types';

export const shouldDisplayReconnectButton = (installedSnap?: Snap) =>
  // if there is an installed snap, we always want to show the reconnect button
  Boolean(installedSnap);

export const handleSnapConnectClick = async (
  dispatch: Dispatch<MetamaskDispatch>,
) => {
  try {
    await connectSnap(defaultSnapOrigin);
    const installedSnap = await getSnap(defaultSnapOrigin);

    dispatch({
      type: MetamaskActions.SetInstalled,
      payload: installedSnap,
    });
    dispatch({
      type: MetamaskActions.SetInfo,
      payload: `Connected to Galactica Snap`,
    });
  } catch (error) {
    console.error(error);
    dispatch({ type: MetamaskActions.SetError, payload: error });
  }
};

export const handleWalletConnectClick = async (
  dispatch: Dispatch<MetamaskDispatch>,
) => {
  try {
    // @ts-expect-error https://github.com/metamask/providers/issues/200
    const provider = new ethers.providers.Web3Provider(window.ethereum);

    // Will open the MetaMask UI
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    // TODO: You should disable this button while the request is pending!
    const signer = provider.getSigner();
    console.log('Connected with Metamask to', await signer.getAddress());

    dispatch({
      type: MetamaskActions.SetConnected,
      payload: await signer.getAddress(),
    });
    dispatch({
      type: MetamaskActions.SetInfo,
      payload: `Connected to Metamask`,
    });
  } catch (error) {
    console.error(error);
    dispatch({ type: MetamaskActions.SetError, payload: error });
  }
};

export const changeSnapSelection = async (
  event: any,
  dispatch: Dispatch<MetamaskDispatch>,
) => {
  try {
    console.log('updated selection to', event.target.value);

    // dispatch({
    //   type: MetamaskActions.SetConnected,
    //   payload: await signer.getAddress(),
    // });
    // dispatch({ type: MetamaskActions.SetInfo, payload: `Connected to Metamask` });
  } catch (error) {
    console.error(error);
    dispatch({ type: MetamaskActions.SetError, payload: error });
  }
};
