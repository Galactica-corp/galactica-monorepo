import { ethers } from 'ethers';

/**
 * Detects if the wallet injecting the ethereum object is Flask.
 *
 * @returns True if the MetaMask version is Flask, false otherwise.
 */
export const isFlask = async () => {
  const provider = window.ethereum;

  try {
    const clientVersion = await provider?.request({
      method: 'web3_clientVersion',
    });

    const isFlaskDetected = (clientVersion as string[])?.includes('flask');

    return Boolean(provider && isFlaskDetected);
  } catch {
    return false;
  }
};

/**
 * Gets the current block time.
 *
 * @returns The current block time.
 */
export async function getCurrentBlockTime(): Promise<number> {
  // @ts-ignore https://github.com/metamask/providers/issues/200
  const provider = new ethers.providers.Web3Provider(window.ethereum);

  return (await provider.getBlock('latest')).timestamp;
}

/**
 * Gets the user address if it is available.
 *
 * @returns The user address.
 * @throws Error if no user address is found.
 */
export function getUserAddress(): string {
  const userAddress = window.ethereum.selectedAddress;
  if (userAddress === null) {
    throw new Error('Please connect a metamask account first.');
  }
  return userAddress;
}

/**
 * Detects the signer address.
 *
 * @returns The signer address or undefined if not found.
 */
export async function detectSignerAddress() {
  if (!window.ethereum) {
    return undefined;
  }
  // @ts-ignore https://github.com/metamask/providers/issues/200
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  if (!signer) {
    return undefined;
  }

  try {
    return await signer.getAddress();
  } catch {
    return undefined;
  }
}
