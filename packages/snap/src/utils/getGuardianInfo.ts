import type { ZkCertRegistered } from '@galactica-net/galactica-types';
import {
  GuardianRegistry__factory as GuardianRegistryFactory,
  ZkCertificateRegistry__factory as ZkCertificateRegistryFactory,
} from '@galactica-net/zk-certificates/typechain-types';
import type { SnapsEthereumProvider } from '@metamask/snaps-sdk';
import { BrowserProvider, Contract } from 'ethers';

import { fetchIpfsContent } from './fetchIpfsContent';
import { switchChain } from './utils';

/**
 *
 * @param cert - Zk Certificate
 * @param ethereum - The Ethereum provider that is available as global in the snap.
 * @returns - Information about guardian that issue certificate
 */
export async function getGuardianInfo(
  cert: ZkCertRegistered<Record<string, unknown>>,
  ethereum: SnapsEthereumProvider,
) {
  try {
    // we can only find the guardian info on the chain the certificate is issued on
    await switchChain(cert.registration.chainID, ethereum);

    const provider = new BrowserProvider(ethereum);
    const kycRecordRegistryContract = new Contract(
      cert.registration.address,
      ZkCertificateRegistryFactory.abi,
      provider,
    );

    const guardianRegistryAddress =
      await kycRecordRegistryContract.guardianRegistry();

    const guardianRegistryContract = new Contract(
      guardianRegistryAddress,
      GuardianRegistryFactory.abi,
      provider,
    );

    const guardianAddress = await guardianRegistryContract.pubKeyToAddress(
      BigInt(cert.providerData.ax),
      BigInt(cert.providerData.ay),
    );

    const [isWhitelisted, metaUrl]: [boolean, string] =
      await guardianRegistryContract.guardians(guardianAddress);
    if (metaUrl) {
      const content = await fetchIpfsContent(metaUrl);

      return { data: { ...content, address: guardianAddress }, isWhitelisted };
    }
  } catch (error) {
    console.error(error);
  }

  return undefined;
}
