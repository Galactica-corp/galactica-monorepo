import { getSnap } from '@galactica-net/snap-api';
import type { Dispatch, ReactNode, Reducer } from 'react';
import { createContext, useEffect, useReducer } from 'react';

import { defaultSnapOrigin } from '../config/snap';
import type { Snap } from '../types';
import type { SBT } from '../utils';
import { detectSignerAddress, isFlask } from '../utils';

export type MetamaskState = {
  isFlask: boolean;
  installedSnap?: Snap;
  error?: Error;
  info?: string;
  signer?: string;
  proofData?: any;
  verificationSbts: SBT[];
  guardianNameMap: Map<string[2], string>;
};

const initialState: MetamaskState = {
  isFlask: false,
  error: undefined,
  info: undefined,
  signer: undefined,
  proofData: undefined,
  verificationSbts: [],
  guardianNameMap: new Map<string[2], string>(),
};

export type MetamaskDispatch = { type: MetamaskActions; payload: any };

export const MetaMaskContext = createContext<
  [MetamaskState, Dispatch<MetamaskDispatch>]
>([
  initialState,
  () => {
    /* no op */
  },
]);

export enum MetamaskActions {
  SetInstalled = 'SetInstalled',
  SetFlaskDetected = 'SetFlaskDetected',
  SetError = 'SetError',
  SetInfo = 'SetInfo',
  SetConnected = 'SetConnected',
  SetProofData = 'SetProofData',
  SetVerificationSBT = 'SetVerificationSBT',
}

const reducer: Reducer<MetamaskState, MetamaskDispatch> = (state, action) => {
  switch (action.type) {
    case MetamaskActions.SetInstalled:
      return {
        ...state,
        installedSnap: action.payload,
      };

    case MetamaskActions.SetFlaskDetected:
      return {
        ...state,
        isFlask: action.payload,
      };

    case MetamaskActions.SetError:
      return {
        ...state,
        error: action.payload,
      };

    case MetamaskActions.SetInfo:
      return {
        ...state,
        info: action.payload,
      };

    case MetamaskActions.SetConnected:
      return {
        ...state,
        signer: action.payload,
      };

    case MetamaskActions.SetProofData:
      return {
        ...state,
        proofData: action.payload,
      };

    case MetamaskActions.SetVerificationSBT:
      return {
        ...state,
        verificationSbts: action.payload.sbts,
        guardianNameMap: action.payload.guardianNameMap,
      };

    default:
      return state;
  }
};

/**
 * MetaMask context provider to handle MetaMask and snap status.
 *
 * @param props - React Props.
 * @param props.children - React component to be wrapped by the Provider.
 * @returns JSX.
 */
export const MetaMaskProvider = ({ children }: { children: ReactNode }) => {
  if (typeof window === 'undefined') {
    return <>{children}</>;
  }

  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    /**
     * Detects if the wallet is Flask.
     */
    async function detectFlask() {
      try {
        const isFlaskDetected = await isFlask();

        dispatch({
          type: MetamaskActions.SetFlaskDetected,
          payload: isFlaskDetected,
        });
      } catch (error) {
        console.error('Error detecting Flask:', error);
      }
    }

    detectFlask().catch((error) => {
      console.error('Error in detectFlask:', error);
    });
  }, [state.isFlask, window.ethereum]);

  useEffect(() => {
    /**
     * Detects if the snap is installed.
     */
    async function detectSnapInstalled() {
      try {
        const installedSnap = await getSnap(defaultSnapOrigin);
        console.log(
          'installedSnap',
          JSON.stringify(installedSnap),
          defaultSnapOrigin,
        );
        dispatch({
          type: MetamaskActions.SetInstalled,
          payload: installedSnap,
        });
      } catch (error) {
        console.error('Error detecting snap installation:', error);
      }
    }

    detectSnapInstalled().catch((error) => {
      console.error('Error in detectSnapInstalled:', error);
    });
  }, [state.isFlask, window.ethereum]);

  useEffect(() => {
    /**
     * Detects the connected wallet.
     */
    async function detectConnectedWallet() {
      try {
        const signer = await detectSignerAddress();
        dispatch({
          type: MetamaskActions.SetConnected,
          payload: signer,
        });
      } catch (error) {
        console.error('Error detecting connected wallet:', error);
      }
    }

    detectConnectedWallet().catch((error) => {
      console.error('Error in detectConnectedWallet:', error);
    });
  }, [state.isFlask, window.ethereum]);

  useEffect(() => {
    let timeoutId: number;

    if (state.error) {
      timeoutId = window.setTimeout(() => {
        dispatch({
          type: MetamaskActions.SetError,
          payload: undefined,
        });
      }, 10000);
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [state.error]);

  useEffect(() => {
    let timeoutId: number;

    if (state.info) {
      timeoutId = window.setTimeout(() => {
        dispatch({
          type: MetamaskActions.SetInfo,
          payload: undefined,
        });
      }, 10000);
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [state.info]);

  return (
    <MetaMaskContext.Provider value={[state, dispatch]}>
      {children}
    </MetaMaskContext.Provider>
  );
};
